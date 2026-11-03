//! The microphone, for recording on the Sound page. WebKitGTK denies `getUserMedia` unless the app
//! answers the webview's permission request (it has no prompt of its own); WebView2 prompts
//! unless answered. See `docs/superpowers/specs/2026-11-03-microphone-check.md`.

use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{Runtime, Webview};

/// Lets the app's own pages open the microphone (recording on the Sound page). Every other
/// request, and every other page, keeps the webview's default.
pub fn permission_request<R: Runtime>(
    webview: Webview<R>,
    kind: PermissionKind,
) -> PermissionResponse {
    match kind {
        PermissionKind::Microphone if is_app_page(&webview) => PermissionResponse::Allow,
        _ => PermissionResponse::Default,
    }
}

/// The dev server's port (`devUrl` in `tauri.conf.json`).
const DEV_PORT: u16 = 1420;

/// The app's own origins: built on Linux/macOS, built on Windows, and, in debug builds only, the
/// dev server.
fn is_app_page<R: Runtime>(webview: &Webview<R>) -> bool {
    webview.url().is_ok_and(|url| {
        let dev = cfg!(debug_assertions) && url.port() == Some(DEV_PORT);
        match (url.scheme(), url.host_str()) {
            ("tauri", Some("localhost")) | ("http" | "https", Some("tauri.localhost")) => true,
            ("http", Some("localhost")) => dev,
            _ => false,
        }
    })
}
