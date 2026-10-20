/** Use the matching local hostname so browser site isolation remains strict. */
export function resolveApiOrigin(hostname?:string):string {
  const configured=process.env.NEXT_PUBLIC_API_URL;
  if(configured)return configured.replace(/\/$/,"");
  const active=hostname??(typeof window==="undefined"?"localhost":window.location.hostname);
  return active==="127.0.0.1"?"http://127.0.0.1:8000":"http://localhost:8000";
}
