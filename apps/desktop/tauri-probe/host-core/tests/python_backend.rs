use alinha_desktop_host_core::Backend;
use std::path::Path;

#[test]
fn authenticated_python_server_is_started_probed_and_stopped() {
    let Some(path) = std::env::var_os("ALINHA_TEST_PYTHON") else {
        eprintln!("SKIPPED: configure ALINHA_TEST_PYTHON for live loopback integration");
        return;
    };
    let mut backend = Backend::launch(Path::new(&path)).expect("Python readiness & token");
    assert!(backend.healthy(), "Authenticated health is required");
    let reply = backend.request("GET", "/api/v1/providers/status", "", "")
        .expect("Only the Rust process attaches the token");
    assert_eq!(reply.status, 200, "Native bridge can read a safe Python route");

    // A synthetic malformed JSON request tests the Python Origin guard:
    // validation should reject it as 422, NOT the missing Origin 403.
    let rejected = backend.request("POST", "/api/v1/ats/check/text",
        "application/json", "e30=").expect("Python receives the signed mutation");
    assert_eq!(rejected.status, 422, "Native mutation must pass origin authentication");
    assert!(backend.request("POST", "/api/v1/application/submit",
        "application/json", "e30=").is_err(), "No external job application is allowed");

    backend.stop();
    assert!(!backend.healthy(), "Child process must not survive shutdown");
}
