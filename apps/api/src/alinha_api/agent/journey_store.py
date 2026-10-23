"""Crash-aware SQLite run ledger for the actual Community agent, not the fake demo.

The UI cannot mark tools complete. Tool dispatch uses backend-only leases.
Job-search results are public third-party listing data, never CVs or credentials.
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from pydantic import UUID4, BaseModel, ConfigDict, Field, field_validator

from alinha_api.agent.assessment import AssessmentReport
from alinha_api.agent.discovery import JobSearchResult
from alinha_api.agent.preview import PreviewBatch, prepare_local_previews
from alinha_api.services.community_storage import user_paths

RunState = Literal["ready", "running", "needs_review", "completed", "failed", "cancelled"]
Tool = Literal["job.search", "job.assess", "application.preview"]
MAX_AGE_SECONDS = 14 * 86400
MAX_RESULT_BYTES = 350_000
MAX_ASSESSMENT_BYTES = 100_000
MAX_PREVIEW_BYTES = 60_000


class JourneyConflict(Exception):
    """Conflicting request, stale step, or unauthorized transition."""


class JourneyNotFound(Exception):
    """Unknown journey identifier."""


class JourneyStorageUnavailable(Exception):
    """Storage failure must not allow an untracked action to run."""


class StartJourney(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    run_id: UUID4
    request_id: UUID4
    query: str = Field(min_length=2, max_length=80)
    search_authorized: Literal[True]
    prepare_preview: bool = False
    max_jobs: int = Field(default=10, ge=1, le=15)
    profile_revision: int | None = Field(default=None, ge=1, le=2**31)

    @field_validator("query")
    @classmethod
    def safe_query(cls, value: str) -> str:
        if re.search(r"https?://|[<>\r\n{}]|@", value, flags=re.IGNORECASE):
            raise ValueError("Cargo de pesquisa inválido.")
        return value


class JourneyEvent(BaseModel):
    sequence: int
    step: str
    status: Literal["created", "running", "completed", "cancelled", "interrupted", "failed"]
    summary: str
    external_submission: Literal[False] = False


class JourneySnapshot(BaseModel):
    run_id: UUID
    status: RunState
    query: str
    next_step: int
    plan: list[Tool]
    events: list[JourneyEvent]
    result_count: int | None = None
    profile_revision: int | None = None
    external_submission: Literal[False] = False


class StepLease(BaseModel):
    run_id: UUID
    index: int
    tool: Tool
    token: UUID
    max_jobs: int
    query: str
    profile_revision: int | None = None


class JourneyStore:
    """Transactional run state; API handlers never accept a user-provided step result."""

    def __init__(self, path: Path | None = None):
        self.path = path or user_paths()[1]

    @contextmanager
    def _db(self) -> Iterator[sqlite3.Connection]:
        connection: sqlite3.Connection | None = None
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            connection = sqlite3.connect(self.path, timeout=3, isolation_level=None)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA busy_timeout=3000")
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("""
                CREATE TABLE IF NOT EXISTS agent_journeys (
                    run_id TEXT PRIMARY KEY, request_id TEXT UNIQUE NOT NULL,
                    signature TEXT NOT NULL, query TEXT NOT NULL,
                    plan TEXT NOT NULL, status TEXT NOT NULL,
                    next_step INTEGER NOT NULL DEFAULT 0,
                    max_jobs INTEGER NOT NULL, active_token TEXT,
                    step_started_at INTEGER, result_count INTEGER,
                    profile_revision INTEGER,
                    created_at INTEGER NOT NULL
                )
            """)
            # Safe additive migration for databases created before the profile gate.
            columns = {row[1] for row in connection.execute("PRAGMA table_info(agent_journeys)")}
            if "profile_revision" not in columns:
                connection.execute("ALTER TABLE agent_journeys ADD COLUMN profile_revision INTEGER")
            connection.execute("""
                CREATE TABLE IF NOT EXISTS agent_journey_events (
                    run_id TEXT NOT NULL, sequence INTEGER NOT NULL,
                    step TEXT NOT NULL, status TEXT NOT NULL, summary TEXT NOT NULL,
                    PRIMARY KEY (run_id, sequence)
                )
            """)
            connection.execute("""
                CREATE TABLE IF NOT EXISTS agent_journey_search_results (
                    run_id TEXT PRIMARY KEY, payload TEXT NOT NULL,
                    stored_at INTEGER NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES agent_journeys(run_id)
                )
            """)
            connection.execute("""
                CREATE TABLE IF NOT EXISTS agent_journey_assessments (
                    run_id TEXT PRIMARY KEY, payload TEXT NOT NULL,
                    profile_revision INTEGER NOT NULL, stored_at INTEGER NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES agent_journeys(run_id)
                )
            """)
            connection.execute("""
                CREATE TABLE IF NOT EXISTS agent_journey_previews (
                    run_id TEXT PRIMARY KEY, payload TEXT NOT NULL,
                    profile_revision INTEGER NOT NULL, stored_at INTEGER NOT NULL,
                    FOREIGN KEY(run_id) REFERENCES agent_journeys(run_id)
                )
            """)
            yield connection
            connection.execute("COMMIT")
        except (sqlite3.Error, OSError) as exc:
            if connection is not None and connection.in_transaction:
                connection.rollback()
            raise JourneyStorageUnavailable("Armazenamento da jornada indisponível.") from exc
        except Exception:
            if connection is not None and connection.in_transaction:
                connection.rollback()
            raise
        finally:
            if connection is not None:
                connection.close()

    @staticmethod
    def _row(conn: sqlite3.Connection, run_id: UUID) -> sqlite3.Row:
        row = conn.execute("SELECT * FROM agent_journeys WHERE run_id=?", (str(run_id),)).fetchone()
        if row is None:
            raise JourneyNotFound("Jornada não encontrada.")
        return row

    @staticmethod
    def _event(conn: sqlite3.Connection, run_id: str, step: str, status: str, summary: str) -> None:
        conn.execute(
            """
            INSERT INTO agent_journey_events(run_id,sequence,step,status,summary)
            SELECT ?, COALESCE(MAX(sequence),0)+1, ?, ?, ?
            FROM agent_journey_events WHERE run_id=?
        """,
            (run_id, step, status, summary, run_id),
        )

    @staticmethod
    def _snapshot(conn: sqlite3.Connection, row: sqlite3.Row) -> JourneySnapshot:
        events = conn.execute(
            """
            SELECT sequence,step,status,summary FROM agent_journey_events
            WHERE run_id=? ORDER BY sequence
        """,
            (row["run_id"],),
        ).fetchall()
        return JourneySnapshot(
            run_id=row["run_id"],
            status=row["status"],
            query=row["query"],
            next_step=row["next_step"],
            plan=json.loads(row["plan"]),
            events=[JourneyEvent(**dict(e)) for e in events],
            result_count=row["result_count"],
            profile_revision=row["profile_revision"],
        )

    def create(self, request: StartJourney) -> JourneySnapshot:
        data = request.model_dump(mode="json")
        signature = hashlib.sha256(
            json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        plan: list[Tool] = ["job.search", "job.assess"]
        if request.prepare_preview:
            plan.append("application.preview")
        with self._db() as conn:
            old = conn.execute(
                "SELECT * FROM agent_journeys WHERE request_id=? OR run_id=?",
                (str(request.request_id), str(request.run_id)),
            ).fetchone()
            if old is not None:
                if old["signature"] != signature:
                    raise JourneyConflict("Identificador já utilizado com outros parâmetros.")
                return self._snapshot(conn, old)
            # Only expired terminal runs are pruned. Never erase active work automatically.
            cutoff = int(time.time()) - MAX_AGE_SECONDS
            conn.execute(
                "DELETE FROM agent_journey_previews WHERE run_id IN "
                "(SELECT run_id FROM agent_journeys WHERE created_at < ? "
                "AND status IN ('completed','cancelled','failed'))",
                (cutoff,),
            )
            conn.execute(
                "DELETE FROM agent_journey_assessments WHERE run_id IN "
                "(SELECT run_id FROM agent_journeys WHERE created_at < ? "
                "AND status IN ('completed','cancelled','failed'))",
                (cutoff,),
            )
            conn.execute(
                "DELETE FROM agent_journey_search_results WHERE run_id IN "
                "(SELECT run_id FROM agent_journeys WHERE created_at < ? "
                "AND status IN ('completed','cancelled','failed'))",
                (cutoff,),
            )
            conn.execute(
                "DELETE FROM agent_journey_events WHERE run_id IN "
                "(SELECT run_id FROM agent_journeys WHERE created_at < ? "
                "AND status IN ('completed','cancelled','failed'))",
                (cutoff,),
            )
            conn.execute(
                "DELETE FROM agent_journeys WHERE created_at < ? "
                "AND status IN ('completed','cancelled','failed')",
                (cutoff,),
            )
            active = conn.execute(
                "SELECT COUNT(*) FROM agent_journeys WHERE status NOT IN "
                "('completed','cancelled','failed')"
            ).fetchone()[0]
            if active >= 200:
                raise JourneyConflict("Limite de jornadas locais ativas atingido.")
            conn.execute(
                """
                INSERT INTO agent_journeys
                (run_id,request_id,signature,query,plan,status,max_jobs,profile_revision,created_at)
                VALUES (?,?,?,?,?,'ready',?,?,?)
            """,
                (
                    str(request.run_id),
                    str(request.request_id),
                    signature,
                    request.query,
                    json.dumps(plan),
                    request.max_jobs,
                    request.profile_revision,
                    int(time.time()),
                ),
            )
            self._event(
                conn,
                str(request.run_id),
                "plan",
                "created",
                "Plano validado. A pesquisa só poderá executar com autorização.",
            )
            return self._snapshot(conn, self._row(conn, request.run_id))

    def get(self, run_id: UUID) -> JourneySnapshot:
        with self._db() as conn:
            return self._snapshot(conn, self._row(conn, run_id))

    def cancel(self, run_id: UUID) -> JourneySnapshot:
        with self._db() as conn:
            row = self._row(conn, run_id)
            if row["status"] not in ("completed", "failed", "cancelled"):
                conn.execute(
                    "UPDATE agent_journeys SET status='cancelled',active_token=NULL WHERE run_id=?",
                    (str(run_id),),
                )
                self._event(
                    conn,
                    str(run_id),
                    "cancel",
                    "cancelled",
                    "Execução cancelada. Nenhuma candidatura foi enviada.",
                )
            return self._snapshot(conn, self._row(conn, run_id))

    def begin_step(self, run_id: UUID, expected_step: int) -> StepLease:
        """Internal-only reservation before any tool call, with an opaque lease."""
        with self._db() as conn:
            row = self._row(conn, run_id)
            plan = json.loads(row["plan"])
            if row["status"] != "ready" or row["next_step"] != expected_step:
                raise JourneyConflict("Etapa já iniciada, cancelada ou fora de ordem.")
            if expected_step >= len(plan):
                raise JourneyConflict("Jornada sem etapas pendentes.")
            token = uuid4()
            conn.execute(
                "UPDATE agent_journeys SET status='running',active_token=?,step_started_at=? "
                "WHERE run_id=?",
                (str(token), int(time.time()), str(run_id)),
            )
            self._event(
                conn,
                str(run_id),
                plan[expected_step],
                "running",
                "Ferramenta iniciada pelo coordenador.",
            )
            return StepLease(
                run_id=run_id,
                index=expected_step,
                tool=plan[expected_step],
                token=token,
                query=row["query"],
                max_jobs=row["max_jobs"],
                profile_revision=row["profile_revision"],
            )

    def finish_step(self, lease: StepLease, *, result_count: int | None = None) -> JourneySnapshot:
        """Called only by a trusted executor after output verification."""
        if result_count is not None and not (0 <= result_count <= lease.max_jobs):
            raise JourneyConflict("Resultado fora do limite autorizado.")
        with self._db() as conn:
            row = self._row(conn, lease.run_id)
            plan = json.loads(row["plan"])
            if (
                row["status"] != "running"
                or row["active_token"] != str(lease.token)
                or row["next_step"] != lease.index
                or plan[lease.index] != lease.tool
            ):
                raise JourneyConflict("Ação cancelada, repetida ou obsoleta.")
            next_step = lease.index + 1
            new_status = "needs_review" if next_step == len(plan) else "ready"
            conn.execute(
                "UPDATE agent_journeys SET status=?,next_step=?,active_token=NULL,"
                "step_started_at=NULL,result_count=COALESCE(?,result_count) WHERE run_id=?",
                (new_status, next_step, result_count, str(lease.run_id)),
            )
            self._event(
                conn,
                str(lease.run_id),
                lease.tool,
                "completed",
                "Etapa concluída pelo executor autorizado; nenhum envio externo.",
            )
            return self._snapshot(conn, self._row(conn, lease.run_id))

    @staticmethod
    def _require_active_lease(row: sqlite3.Row, lease: StepLease) -> None:
        plan = json.loads(row["plan"])
        if (
            row["status"] != "running"
            or row["active_token"] != str(lease.token)
            or row["next_step"] != lease.index
            or lease.index >= len(plan)
            or plan[lease.index] != lease.tool
        ):
            raise JourneyConflict("Ação cancelada, repetida ou obsoleta.")

    def finish_search(self, lease: StepLease, result: JobSearchResult) -> JourneySnapshot:
        """Persist allowlisted search output and completion in one SQLite transaction."""
        if lease.index != 0 or lease.tool != "job.search":
            raise JourneyConflict("Somente o executor de busca pode gravar vagas.")
        result = JobSearchResult.model_validate(result)
        if len(result.jobs) > lease.max_jobs:
            raise JourneyConflict("Resultados excederam o limite autorizado.")
        payload = result.model_dump_json()
        if len(payload.encode("utf-8")) > MAX_RESULT_BYTES:
            raise JourneyConflict("Resultados excederam o tamanho permitido.")
        with self._db() as conn:
            row = self._row(conn, lease.run_id)
            self._require_active_lease(row, lease)
            conn.execute(
                "INSERT INTO agent_journey_search_results(run_id,payload,stored_at) VALUES (?,?,?)",
                (str(lease.run_id), payload, int(time.time())),
            )
            conn.execute(
                "UPDATE agent_journeys SET status='ready',next_step=1,active_token=NULL,"
                "step_started_at=NULL,result_count=? WHERE run_id=?",
                (len(result.jobs), str(lease.run_id)),
            )
            self._event(
                conn,
                str(lease.run_id),
                "job.search",
                "completed",
                "Consulta concluída; resultados de fontes públicas disponíveis para revisão.",
            )
            return self._snapshot(conn, self._row(conn, lease.run_id))

    def get_search_result(self, run_id: UUID) -> JobSearchResult:
        with self._db() as conn:
            row = self._row(conn, run_id)
            stored = conn.execute(
                "SELECT payload FROM agent_journey_search_results WHERE run_id=?",
                (str(run_id),),
            ).fetchone()
            if stored is None or row["result_count"] is None:
                raise JourneyConflict("Resultados ainda não disponíveis.")
            return JobSearchResult.model_validate_json(stored["payload"])

    def finish_assessment(self, lease: StepLease, result: AssessmentReport) -> JourneySnapshot:
        """Commit verified skill signals only; never persist the full résumé."""
        if lease.index != 1 or lease.tool != "job.assess":
            raise JourneyConflict("Somente a comparação autorizada pode salvar avaliações.")
        result = AssessmentReport.model_validate(result)
        if lease.profile_revision is None or result.profile_revision != lease.profile_revision:
            raise JourneyConflict("A versão do currículo não corresponde à jornada.")
        if len(result.jobs) > lease.max_jobs:
            raise JourneyConflict("Avaliação excedeu o limite de vagas.")
        payload = result.model_dump_json()
        if len(payload.encode("utf-8")) > MAX_ASSESSMENT_BYTES:
            raise JourneyConflict("Avaliação excedeu o tamanho permitido.")
        with self._db() as conn:
            row = self._row(conn, lease.run_id)
            self._require_active_lease(row, lease)
            stored = conn.execute(
                "SELECT payload FROM agent_journey_search_results WHERE run_id=?",
                (str(lease.run_id),),
            ).fetchone()
            if stored is None:
                raise JourneyConflict("Não existem vagas persistidas para avaliar.")
            listings = JobSearchResult.model_validate_json(stored["payload"])
            expected = [(j.opportunity.source, j.opportunity.external_id) for j in listings.jobs]
            actual = [(j.source, j.external_id) for j in result.jobs]
            if actual != expected:
                raise JourneyConflict("Avaliação não corresponde às vagas recuperadas.")
            next_step = 2
            plan = json.loads(row["plan"])
            new_status = "needs_review" if next_step == len(plan) else "ready"
            conn.execute(
                "INSERT INTO agent_journey_assessments"
                "(run_id,payload,profile_revision,stored_at) VALUES (?,?,?,?)",
                (str(lease.run_id), payload, result.profile_revision, int(time.time())),
            )
            conn.execute(
                "UPDATE agent_journeys SET status=?,next_step=?,active_token=NULL,"
                "step_started_at=NULL WHERE run_id=?",
                (new_status, next_step, str(lease.run_id)),
            )
            self._event(
                conn,
                str(lease.run_id),
                "job.assess",
                "completed",
                "Coincidências literais registradas para revisão, sem usar IA.",
            )
            return self._snapshot(conn, self._row(conn, lease.run_id))

    def get_assessment(self, run_id: UUID) -> AssessmentReport:
        with self._db() as conn:
            self._row(conn, run_id)
            stored = conn.execute(
                "SELECT payload FROM agent_journey_assessments WHERE run_id=?",
                (str(run_id),),
            ).fetchone()
            if stored is None:
                raise JourneyConflict("A comparação ainda não está disponível.")
            return AssessmentReport.model_validate_json(stored["payload"])

    def finish_previews(self, lease: StepLease, batch: PreviewBatch) -> JourneySnapshot:
        """Persist only the exact previews deterministically derived from stored facts."""
        if lease.index != 2 or lease.tool != "application.preview":
            raise JourneyConflict("Etapa de prévia não autorizada.")
        batch = PreviewBatch.model_validate(batch)
        if lease.profile_revision is None or batch.profile_revision != lease.profile_revision:
            raise JourneyConflict("Versão do currículo inconsistente com a jornada.")
        payload = batch.model_dump_json()
        if len(payload.encode("utf-8")) > MAX_PREVIEW_BYTES:
            raise JourneyConflict("Prévias excederam o tamanho permitido.")
        with self._db() as conn:
            row = self._row(conn, lease.run_id)
            self._require_active_lease(row, lease)
            search = conn.execute(
                "SELECT payload FROM agent_journey_search_results WHERE run_id=?",
                (str(lease.run_id),),
            ).fetchone()
            assessed = conn.execute(
                "SELECT payload FROM agent_journey_assessments WHERE run_id=?",
                (str(lease.run_id),),
            ).fetchone()
            if not search or not assessed:
                raise JourneyConflict("Dados necessários para a prévia estão incompletos.")
            expected = prepare_local_previews(
                AssessmentReport.model_validate_json(assessed["payload"]),
                JobSearchResult.model_validate_json(search["payload"]),
            )
            if batch != expected:
                raise JourneyConflict("Prévia divergente dos dados e das regras verificadas.")
            conn.execute(
                "INSERT INTO agent_journey_previews "
                "(run_id,payload,profile_revision,stored_at) VALUES (?,?,?,?)",
                (str(lease.run_id), payload, batch.profile_revision, int(time.time())),
            )
            conn.execute(
                "UPDATE agent_journeys SET status='needs_review',next_step=3,"
                "active_token=NULL,step_started_at=NULL WHERE run_id=?",
                (str(lease.run_id),),
            )
            self._event(
                conn,
                str(lease.run_id),
                "application.preview",
                "completed",
                "Prévias locais prontas para revisão; nenhuma candidatura enviada.",
            )
            return self._snapshot(conn, self._row(conn, lease.run_id))

    def get_previews(self, run_id: UUID) -> PreviewBatch:
        with self._db() as conn:
            self._row(conn, run_id)
            found = conn.execute(
                "SELECT payload FROM agent_journey_previews WHERE run_id=?",
                (str(run_id),),
            ).fetchone()
            if found is None:
                raise JourneyConflict("Prévias ainda não disponíveis.")
            return PreviewBatch.model_validate_json(found["payload"])

    def fail_step(self, lease: StepLease) -> JourneySnapshot:
        """Record fixed, non-sensitive failure text; never store connector exceptions."""
        with self._db() as conn:
            row = self._row(conn, lease.run_id)
            self._require_active_lease(row, lease)
            conn.execute(
                "UPDATE agent_journeys SET status='failed',active_token=NULL,"
                "step_started_at=NULL WHERE run_id=?",
                (str(lease.run_id),),
            )
            self._event(
                conn,
                str(lease.run_id),
                lease.tool,
                "failed",
                "Não foi possível executar esta etapa. Nenhuma candidatura foi enviada.",
            )
            return self._snapshot(conn, self._row(conn, lease.run_id))

    def interrupt_stale(self, *, min_age_seconds: int = 60) -> int:
        """Never silently replay an ambiguous in-flight tool after a restart."""
        if min_age_seconds < 1:
            raise ValueError("Intervalo de recuperação deve ser positivo.")
        with self._db() as conn:
            ids = conn.execute(
                "SELECT run_id,plan,next_step FROM agent_journeys "
                "WHERE status='running' AND step_started_at <= ?",
                (int(time.time()) - min_age_seconds,),
            ).fetchall()
            for item in ids:
                tool = json.loads(item["plan"])[item["next_step"]]
                conn.execute(
                    "UPDATE agent_journeys SET status='needs_review',active_token=NULL "
                    "WHERE run_id=?",
                    (item["run_id"],),
                )
                self._event(
                    conn,
                    item["run_id"],
                    tool,
                    "interrupted",
                    "Execução interrompida. Não será repetida automaticamente.",
                )
            return len(ids)
