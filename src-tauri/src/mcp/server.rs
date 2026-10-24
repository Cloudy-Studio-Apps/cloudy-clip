//! The built-in MCP server: Streamable HTTP on `127.0.0.1`, served with axum.
//!
//! Only loopback hosts are accepted (DNS-rebinding protection) and any request carrying a
//! browser `Origin` header is rejected, so web pages cannot drive the editor. Agents (CLIs,
//! desktop apps) do not send `Origin`.

use std::sync::{Arc, RwLock};

use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, InitializeResult, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerConfig,
};
use rmcp::service::RequestContext;
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler};
use serde::Serialize;
use serde_json::{Value, json};

use super::bridge::McpBridge;

/// Default port. Override with the `CLOUDY_CLIP_MCP_PORT` environment variable.
pub const DEFAULT_PORT: u16 = 7420;

const INSTRUCTIONS: &str = "\
Cloudy Clip is a video editor. You edit the same live project the user sees, and every change \
you make goes into the shared undo history (the user can undo it).
- Start with `project_get_state` to see media, tracks and clips.
- All times are integer microseconds (1 s = 1000000).
- Use `preview_capture_frame` to look at the result.
- Tools return errors as JSON with a `code` and a `message`; read the message and adjust.";

/// Current state of the server, readable from the UI.
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub running: bool,
    pub url: Option<String>,
    pub error: Option<String>,
}

#[derive(Default)]
pub struct McpStatusState(pub RwLock<McpStatus>);

#[derive(Clone)]
struct CloudyMcp {
    bridge: Arc<McpBridge>,
}

impl ServerHandler for CloudyMcp {
    fn get_info(&self) -> ServerConfig {
        let mut info = InitializeResult::new(ServerCapabilities::builder().enable_tools().build());
        info.instructions = Some(INSTRUCTIONS.into());
        info.server_info.name = "cloudy-clip".into();
        info.server_info.title = Some("Cloudy Clip".into());
        info.server_info.version = env!("CARGO_PKG_VERSION").into();
        info
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, McpError> {
        serde_json::from_value(json!({ "tools": self.bridge.tools() }))
            .map_err(|e| McpError::internal_error(format!("Could not list tools: {e}"), None))
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, McpError> {
        if !self.bridge.has_tool(&request.name) {
            return Err(McpError::invalid_params(
                format!("Unknown tool \"{}\"", request.name),
                None,
            ));
        }
        let arguments = request
            .arguments
            .map(Value::Object)
            .unwrap_or_else(|| json!({}));
        let result = match self.bridge.call(&request.name, arguments).await {
            Ok(value) => serde_json::from_value::<CallToolResult>(value).map_err(|e| {
                McpError::internal_error(format!("Invalid tool result from the editor: {e}"), None)
            })?,
            Err(error) => serde_json::from_value::<CallToolResult>(json!({
                "content": [{ "type": "text", "text": serde_json::to_string(&error).unwrap_or_default() }],
                "isError": true,
            }))
            .map_err(|e| McpError::internal_error(e.to_string(), None))?,
        };
        Ok(result.into())
    }
}

/// Binds the server and serves until the app exits. Never panics: failures are recorded in
/// the returned status so the UI can show them.
pub async fn serve(bridge: Arc<McpBridge>) -> McpStatus {
    let port = std::env::var("CLOUDY_CLIP_MCP_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);
    let address = format!("127.0.0.1:{port}");

    let listener = match tokio::net::TcpListener::bind(&address).await {
        Ok(listener) => listener,
        Err(e) => {
            return McpStatus {
                running: false,
                url: None,
                error: Some(format!("Could not listen on {address}: {e}")),
            };
        }
    };

    let config = StreamableHttpServerConfig::default().enforce_origin_validation();
    let service = StreamableHttpService::new(
        move || {
            Ok(CloudyMcp {
                bridge: bridge.clone(),
            })
        },
        Arc::new(LocalSessionManager::default()),
        config,
    );
    let router = axum::Router::new().nest_service("/mcp", service);

    tauri::async_runtime::spawn(async move {
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("[mcp] server stopped: {e}");
        }
    });

    McpStatus {
        running: true,
        url: Some(format!("http://{address}/mcp")),
        error: None,
    }
}
