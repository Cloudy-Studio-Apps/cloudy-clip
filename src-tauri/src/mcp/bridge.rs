//! Bridge between the native MCP server and the webview.
//!
//! The tools live in the webview (each frontend module declares them in `<module>.mcp.ts`),
//! because that is where the command bus and the project state are. This bridge:
//! 1. stores the tool manifest the webview publishes (`mcp_register_tools`),
//! 2. forwards each tool call as an `mcp://call` event,
//! 3. waits for the matching `mcp_respond`, with a timeout so an agent never hangs.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, RwLock};
use std::time::Duration;

use rmcp::model::Tool;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

use crate::error::{AppError, AppResult};

/// How long a tool call may take in the webview before the agent gets an error.
const CALL_TIMEOUT: Duration = Duration::from_secs(30);

pub const CALL_EVENT: &str = "mcp://call";

#[derive(Serialize, Clone)]
struct CallPayload<'a> {
    id: String,
    name: &'a str,
    arguments: Value,
}

pub struct McpBridge {
    app: AppHandle,
    tools: RwLock<Vec<Tool>>,
    pending: Mutex<HashMap<String, oneshot::Sender<Value>>>,
    next_id: AtomicU64,
}

impl McpBridge {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            tools: RwLock::new(Vec::new()),
            pending: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(0),
        }
    }

    /// Replaces the published tools.
    pub fn set_tools(&self, tools: Vec<Tool>) -> AppResult<()> {
        *self.tools.write().map_err(|_| poisoned())? = tools;
        Ok(())
    }

    pub fn tools(&self) -> Vec<Tool> {
        self.tools.read().map(|t| t.clone()).unwrap_or_default()
    }

    pub fn has_tool(&self, name: &str) -> bool {
        self.tools
            .read()
            .map(|t| t.iter().any(|tool| tool.name == name))
            .unwrap_or(false)
    }

    /// Forwards a call to the webview and waits for its result (a `CallToolResult` as JSON).
    pub async fn call(&self, name: &str, arguments: Value) -> AppResult<Value> {
        let id = format!("c{}", self.next_id.fetch_add(1, Ordering::Relaxed) + 1);
        let (tx, rx) = oneshot::channel();
        self.pending
            .lock()
            .map_err(|_| poisoned())?
            .insert(id.clone(), tx);

        let payload = CallPayload {
            id: id.clone(),
            name,
            arguments,
        };
        if let Err(e) = self.app.emit(CALL_EVENT, payload) {
            self.forget(&id);
            return Err(AppError::Unavailable(format!(
                "Could not reach the editor UI: {e}"
            )));
        }

        match tokio::time::timeout(CALL_TIMEOUT, rx).await {
            Ok(Ok(result)) => Ok(result),
            Ok(Err(_)) => Err(AppError::Unavailable(
                "The editor UI dropped the call".into(),
            )),
            Err(_) => {
                self.forget(&id);
                Err(AppError::Unavailable(format!(
                    "Tool \"{name}\" did not answer within {}s",
                    CALL_TIMEOUT.as_secs()
                )))
            }
        }
    }

    /// Delivers the webview's answer to the waiting call. Unknown ids (late answers after a
    /// timeout) are ignored.
    pub fn respond(&self, id: &str, result: Value) -> AppResult<()> {
        let sender = self.pending.lock().map_err(|_| poisoned())?.remove(id);
        if let Some(sender) = sender {
            let _ = sender.send(result);
        }
        Ok(())
    }

    fn forget(&self, id: &str) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.remove(id);
        }
    }
}

fn poisoned() -> AppError {
    AppError::Unavailable("MCP bridge state is poisoned".into())
}
