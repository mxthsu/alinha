"""Per-request provider-reported token usage, no prompts or secrets.

The context variable keeps concurrent requests isolated. Missing provider usage
is represented as *unknown*, never as free/zero tokens or a fabricated cost.
"""

from __future__ import annotations

from contextvars import ContextVar, Token

from pydantic import BaseModel, ConfigDict, Field

MAX_TOKENS = 100_000_000


class ReportedTokenUsage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    model: str | None = Field(default=None, max_length=100)
    input_tokens: int | None = Field(default=None, ge=0, le=MAX_TOKENS)
    output_tokens: int | None = Field(default=None, ge=0, le=MAX_TOKENS)
    total_tokens: int | None = Field(default=None, ge=0, le=MAX_TOKENS)

    @property
    def reported(self) -> bool:
        return any(
            number is not None
            for number in (self.input_tokens, self.output_tokens, self.total_tokens)
        )


_capture: ContextVar[ReportedTokenUsage | None] = ContextVar(
    "alinha_intent_provider_usage",
    default=None,
)


def begin_usage_capture() -> Token:
    return _capture.set(None)


def captured_usage() -> ReportedTokenUsage | None:
    return _capture.get()


def end_usage_capture(token: Token) -> None:
    _capture.reset(token)


def report_usage(
    *,
    model: object,
    input_tokens: object = None,
    output_tokens: object = None,
    total_tokens: object = None,
) -> None:
    """Accept only bounded nonnegative integer counts actually reported by the API."""

    def count(value: object) -> int | None:
        return value if type(value) is int and 0 <= value <= MAX_TOKENS else None

    model_name = model if isinstance(model, str) and len(model) <= 100 else None
    _capture.set(
        ReportedTokenUsage(
            model=model_name,
            input_tokens=count(input_tokens),
            output_tokens=count(output_tokens),
            total_tokens=count(total_tokens),
        )
    )
