//! Allowlisted IPC bridge. Only the Rust host can attach the Python session secret.
use super::Backend;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::{io::Read, time::Duration};

const MAX_REQUEST_BYTES: usize = 10 * 1024 * 1024;
const MAX_RESPONSE_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct ApiResponse {
    pub status: u16,
    pub content_type: String,
    pub body_base64: String,
}

/// Allow only known local Alinha routes; never accept destinations or arbitrary URLs
/// supplied by untrusted WebView content. New routes require an explicit code review.
pub fn allowed_route(method: &str, path: &str) -> bool {
    if path.len() > 4096 || !path.starts_with("/api/v1/") ||
        path.contains('#') || path.contains('\r') || path.contains('\n') {
        return false;
    }
    let route = path.split('?').next().unwrap_or("");
    if route.contains('%') || route.contains("//") ||
        route.contains("..") || route.contains('\\') {
        return false;
    }
    let data_kind = route.strip_prefix("/api/v1/community/data/")
        .is_some_and(|kind| !kind.is_empty() && kind.len() <= 32 &&
            kind.bytes().all(|b| b.is_ascii_lowercase() || b == b'_' || b == b'-'));
    if data_kind {
        return matches!(method, "GET" | "PUT" | "DELETE");
    }
    matches!((method, route),
        ("GET", "/api/v1/jobs/search") |
        ("GET", "/api/v1/community/settings") |
        ("PUT", "/api/v1/community/settings") |
        ("GET", "/api/v1/community/backup") |
        ("POST", "/api/v1/community/migration") |
        ("POST", "/api/v1/community/restore") |
        ("GET", "/api/v1/providers/status") |
        ("GET", "/api/v1/providers/chatgpt/models") |
        ("POST", "/api/v1/providers/keys/connect") |
        ("POST", "/api/v1/providers/keys/disconnect") |
        ("POST", "/api/v1/providers/chatgpt/login") |
        ("POST", "/api/v1/providers/chatgpt/logout") |
        ("POST", "/api/v1/agent/interpret") |
        ("POST", "/api/v1/analyses/text") |
        ("POST", "/api/v1/analyses/upload") |
        ("POST", "/api/v1/ats/check/text") |
        ("POST", "/api/v1/ats/check/upload") |
        ("POST", "/api/v1/ats/editor/import") |
        ("POST", "/api/v1/ats/editor/export/docx") |
        ("POST", "/api/v1/resumes/structured/import/upload") |
        ("POST", "/api/v1/resumes/structured/preview/text") |
        ("POST", "/api/v1/resumes/structured/export/docx") |
        ("POST", "/api/v1/resumes/structured/review")
    )
}

/// Immutable authenticated client. Can be cloned outside the process-lifecycle lock.
#[derive(Clone)]
pub struct ApiClient { pub(crate) port: u16, pub(crate) secret: String }

impl ApiClient {
    /// The WebView never receives port, token, arbitrary file paths, or raw headers.
    pub fn request(&self, method: &str, path: &str, content_type: &str, body_base64: &str)
        -> Result<ApiResponse, String> {
        if !allowed_route(method, path) {
            return Err("Operação não permitida pela ponte Desktop".into());
        }
        if content_type.len() > 150 || content_type.bytes().any(|b| b.is_ascii_control()) ||
            (!content_type.is_empty() && ![
                "application/json", "multipart/form-data", "text/plain"
            ].iter().any(|kind| content_type.starts_with(kind))) {
            return Err("Tipo de conteúdo não permitido".into());
        }
        if body_base64.len() > (MAX_REQUEST_BYTES + 2) / 3 * 4 {
            return Err("Requisição muito grande".into());
        }
        let body = STANDARD.decode(body_base64).map_err(|_| "Corpo inválido")?;
        if body.len() > MAX_REQUEST_BYTES || (method == "GET" && !body.is_empty()) {
            return Err("Corpo não permitido".into());
        }

        // Explicitly disable automatic redirects and environment HTTP proxies:
        // neither a 3xx response nor a proxy may receive the session secret.
        let agent = ureq::AgentBuilder::new()
            .redirects(0)
            .try_proxy_from_env(false)
            .timeout_connect(Duration::from_secs(2))
            .timeout(Duration::from_secs(35))
            .build();
        let url = format!("http://127.0.0.1:{}{}", self.port, path);
        let mut outgoing = agent.request(method, &url)
            .set("X-Alinha-Desktop-Session", &self.secret)
            .set("Accept", "*/*");
        if !content_type.is_empty() {
            outgoing = outgoing.set("Content-Type", content_type);
        }
        // Python requires a known origin for mutations; never trust an
        // Origin header provided by the WebView or an untrusted page.
        if method != "GET" {
            outgoing = outgoing.set("Origin", "http://localhost:3000");
        }
        let response = match if method == "GET" { outgoing.call() }
            else { outgoing.send_bytes(&body) } {
            Ok(ok) => ok,
            Err(ureq::Error::Status(_, reply)) => reply,
            Err(_) => return Err("API local indisponível".into()),
        };
        let status = response.status();
        let content_type = response.header("Content-Type")
            .unwrap_or("application/octet-stream").chars().take(150).collect();
        let mut bytes = Vec::new();
        response.into_reader().take(MAX_RESPONSE_BYTES + 1).read_to_end(&mut bytes)
            .map_err(|_| "Falha lendo resposta local")?;
        if bytes.len() as u64 > MAX_RESPONSE_BYTES {
            return Err("Resposta excede o limite Desktop".into());
        }
        Ok(ApiResponse { status, content_type, body_base64: STANDARD.encode(bytes) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn allowlisted_methods_only() {
        assert!(allowed_route("GET", "/api/v1/jobs/search?query=Python%20Brasil"));
        assert!(allowed_route("POST", "/api/v1/resumes/structured/import/upload"));
        assert!(allowed_route("POST", "/api/v1/agent/interpret"));
        assert!(allowed_route("PUT", "/api/v1/community/data/profile"));
        for (method, path) in [
            ("POST", "/api/v1/application/submit"),
            ("GET", "https://evil.invalid/steal"),
            ("GET", "//evil.invalid/api/v1/jobs/search"),
            ("GET", "/api/v1/jobs/%2e%2e/secret"),
            ("GET", "/api/v1/jobs/search/../admin"),
            ("DELETE", "/api/v1/providers/keys/connect"),
            ("POST", "/api/v1/jobs/search"),
            ("GET", "/auth/callback"),
        ] {
            assert!(!allowed_route(method, path), "{method} {path}");
        }
    }
}
