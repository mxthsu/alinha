"""Server-controlled deployment policy: self-hosted Community versus managed Cloud.

Cloud is explicitly not launch-ready: do not expose an unauthenticated inference
API with an operator-paid key or repurpose local OAuth credentials for public SaaS.
"""
import os
from typing import Literal, cast

DeploymentMode = Literal["community", "cloud"]


def get_mode() -> DeploymentMode:
    value = os.getenv("ALINHA_DEPLOYMENT_MODE", "community").strip().lower()
    if value not in ("community", "cloud"):
        raise RuntimeError("Modo de implantação do Alinha inválido.")
    return cast(DeploymentMode, value)


def local_chatgpt_allowed() -> bool:
    return get_mode() == "community" and os.getenv("ALINHA_LOCAL_AUTH_ENABLED") == "1"


def local_ollama_allowed() -> bool:
    return get_mode() == "community"


def hosted_analysis_ready() -> bool:
    """Cloud inference must not start until auth, metering and quotas exist."""
    return False
