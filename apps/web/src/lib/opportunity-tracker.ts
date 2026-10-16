/**
 * Community local opportunity tracking. No account, scraping, applicant profile
 * or automated application is represented by these records.
 */
export const TRACKER_KEY = "alinha:opportunities:v1";
export const TRACKER_LIMIT = 200;
export const TRACKER_STATUSES = ["saved", "preparing", "applied", "interview", "offer", "closed"] as const;
export type TrackerStatus = typeof TRACKER_STATUSES[number];

export const TRACKER_LABELS: Record<TrackerStatus, string> = {
  saved: "Salvas",
  preparing: "Em preparação",
  applied: "Candidatura informada",
  interview: "Entrevistas",
  offer: "Propostas",
  closed: "Encerradas",
};

export type TrackedOpportunity = {
  id: string;
  title: string;
  company: string;
  url: string;
  source: string;
  sourceId: string | null;
  status: TrackerStatus;
  addedAt: string;
  updatedAt: string;
};

export type NewOpportunity = Pick<TrackedOpportunity,"title"|"company"|"url"|"source"|"sourceId">;

const PRIVATE_HOST = /(^localhost$|\.localhost$|\.local$|\.internal$|\.test$|\.invalid$)/i;
const SENSITIVE_QUERY = /^(token|access_token|auth|authorization|secret|password|session|sessionid|api_key|apikey|apiKey|accessKey|jwt|authToken|x-amz-signature|signature|sig|code)$/i;
const TRACKING_QUERY = /^(utm_.+|fbclid|gclid|msclkid|igshid)$/i;

export function safeJobUrl(input: string): string | null {
  if (input.length > 1800 || !input.trim()) return null;
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (PRIVATE_HOST.test(host) || host.includes(":") || /^\d+(\.\d+){3}$/.test(host)) return null;
    if (!host.includes(".")) return null;
    if ([...url.searchParams.keys()].some(key => SENSITIVE_QUERY.test(key))) return null;
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString().slice(0,1600);
  } catch {
    return null;
  }
}

/** For deduplication only; never modifies links displayed to the user. */
export function opportunityFingerprint(source: string, sourceId: string | null, url: string): string {
  const normalizedUrl = safeJobUrl(url);
  if (normalizedUrl) return "url:" + normalizedUrl.replace(/\/$/, "").toLowerCase();
  return "source:" + source.trim().toLowerCase() + ":" + (sourceId || "").trim().toLowerCase();
}

function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length >= 2 && value.trim().length <= max;
}

export function parseTracker(raw: unknown): TrackedOpportunity[] {
  if (!Array.isArray(raw) || raw.length > TRACKER_LIMIT) return [];
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  const seenSourceIds = new Set<string>();
  const parsed: TrackedOpportunity[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    if (
      !validText(obj.id, 90) || !validText(obj.title, 180) ||
      !validText(obj.company, 180) || !validText(obj.source, 100) ||
      (obj.sourceId !== null && (typeof obj.sourceId !== "string" || obj.sourceId.length > 200)) ||
      typeof obj.url !== "string" || !TRACKER_STATUSES.includes(obj.status as TrackerStatus) ||
      typeof obj.addedAt !== "string" || !Number.isFinite(Date.parse(obj.addedAt)) ||
      typeof obj.updatedAt !== "string" || !Number.isFinite(Date.parse(obj.updatedAt))
    ) continue;
    const url = safeJobUrl(obj.url);
    if (!url) continue;
    const fingerprint = opportunityFingerprint(obj.source, obj.sourceId, url);
    const sourceKey = obj.sourceId
      ? obj.source.trim().toLowerCase() + ":" + obj.sourceId.trim().toLowerCase()
      : null;
    if (seen.has(fingerprint) || seenIds.has(obj.id) ||
        (sourceKey !== null && seenSourceIds.has(sourceKey))) continue;
    seen.add(fingerprint);
    seenIds.add(obj.id);
    if (sourceKey) seenSourceIds.add(sourceKey);
    parsed.push({
      id: obj.id.trim(), title: obj.title.trim(), company: obj.company.trim(),
      source: obj.source.trim(), sourceId: obj.sourceId,
      url, status: obj.status as TrackerStatus,
      addedAt: obj.addedAt, updatedAt: obj.updatedAt,
    });
  }
  return parsed;
}

export function addOpportunity(
  current: TrackedOpportunity[], input: NewOpportunity, id: string, now: string,
): {items: TrackedOpportunity[]; added: boolean; reason?: string} {
  if (current.length >= TRACKER_LIMIT) return { items:current, added:false, reason:"Limite de 200 vagas salvas atingido." };
  if (!validText(input.title,180) || !validText(input.company,180) ||
      !validText(input.source,100) || !validText(id,90) ||
      (input.sourceId !== null && (typeof input.sourceId !== "string" || input.sourceId.length>200)) ||
      !Number.isFinite(Date.parse(now))) {
    return {items:current,added:false,reason:"Preencha um cargo e empresa válidos."};
  }
  const url = safeJobUrl(input.url);
  if (!url) return {items:current,added:false,reason:"Use um link público HTTPS, sem credenciais ou tokens."};
  const fingerprint = opportunityFingerprint(input.source,input.sourceId,url);
  if (current.some(job =>
    opportunityFingerprint(job.source,job.sourceId,job.url) === fingerprint ||
    (input.sourceId && job.sourceId &&
     job.source.toLowerCase() === input.source.toLowerCase() &&
     job.sourceId.toLowerCase() === input.sourceId.toLowerCase())
  )) {
    return {items:current,added:false,reason:"Esta vaga já está na sua lista."};
  }
  return {
    items:[...current,{...input,title:input.title.trim(),company:input.company.trim(),
      source:input.source.trim(),url,id,status:"saved",addedAt:now,updatedAt:now}],
    added:true,
  };
}

export function changeStatus(items:TrackedOpportunity[], id:string, status:TrackerStatus, now:string):TrackedOpportunity[]{
  if(!TRACKER_STATUSES.includes(status)||!Number.isFinite(Date.parse(now)))return items;
  return items.map(job => job.id === id ? {...job,status,updatedAt:now}:job);
}

export function exportTracker(items:TrackedOpportunity[]):string {
  return JSON.stringify({format:"alinha-opportunities",version:1,items:parseTracker(items)},null,2);
}

export function importTracker(raw:string): TrackedOpportunity[] {
  if (raw.length>320_000) throw new Error("Arquivo muito grande. Limite de 320 KB.");
  let document:unknown;
  try { document=JSON.parse(raw); } catch { throw new Error("O arquivo não contém JSON válido."); }
  if (!document || typeof document!=="object" || Array.isArray(document)) throw new Error("Formato de arquivo inválido.");
  const obj=document as Record<string,unknown>;
  if(obj.format!=="alinha-opportunities"||obj.version!==1||!Array.isArray(obj.items)||obj.items.length>TRACKER_LIMIT) {
    throw new Error("Formato ou versão de exportação incompatível.");
  }
  const items=parseTracker(obj.items);
  if (items.length!==obj.items.length) throw new Error("O arquivo possui itens inválidos ou duplicados.");
  return items;
}
