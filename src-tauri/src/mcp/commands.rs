//! Tauri commands of the MCP module, called by the frontend bridge (`src/core/mcp`).

use std::sync::Arc;

use rmcp::model::Tool;
use serde_json::Value;
use tauri::State;

use super::bridge::McpBridge;
use super::server::{McpStatus, McpStatusState};
use crate::error::AppError;

/// Replaces the tool list with the manifest published by the webview.
#[tauri::command]
pub fn mcp_register_tools(
    tools: Vec<Value>,
    bridge: State<'_, Arc<McpBridge>>,
) -> Result<(), AppError> {
    let tools = tools
        .into_iter()
        .map(serde_json::from_value::<Tool>)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::InvalidInput(format!("Invalid tool manifest: {e}")))?;
    bridge.set_tools(tools)
}

/// Answers a pending tool call.
#[tauri::command]
pub fn mcp_respond(
    id: String,
    result: Value,
    bridge: State<'_, Arc<McpBridge>>,
) -> Result<(), AppError> {
    bridge.respond(&id, result)
}

/// Whether the server is running and where agents can reach it.
#[tauri::command]
pub fn mcp_status(status: State<'_, McpStatusState>) -> McpStatus {
    status.0.read().map(|s| s.clone()).unwrap_or_default()
}
