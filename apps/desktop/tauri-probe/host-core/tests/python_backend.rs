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
    backend.stop();
    assert!(!backend.healthy(), "Child process must not survive shutdown");
}
