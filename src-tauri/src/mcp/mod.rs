//! MCP module: the built-in MCP server that lets agents drive the editor.

pub mod bridge;
pub mod commands;
pub mod server;

use std::sync::Arc;

use tauri::{App, Manager};

use bridge::McpBridge;
use server::McpStatusState;

/// Creates the bridge and starts the server in the background.
pub fn setup(app: &mut App) {
    let bridge = Arc::new(McpBridge::new(app.handle().clone()));
    app.manage(bridge.clone());
    app.manage(McpStatusState::default());

    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        let status = server::serve(bridge).await;
        match &status.error {
            Some(error) => eprintln!("[mcp] {error}"),
            None => println!(
                "[mcp] listening on {}",
                status.url.as_deref().unwrap_or("?")
            ),
        }
        if let Ok(mut current) = handle.state::<McpStatusState>().0.write() {
            *current = status;
        }
    });
}
