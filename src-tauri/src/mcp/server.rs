//! The built-in MCP server: Streamable HTTP on `127.0.0.1`, served with axum.
//!
//! Only loopback hosts are accepted (DNS-rebinding protection) and any request carrying a
//! browser `Origin` header is rejected, so web pages cannot drive the editor. Agents (CLIs,
//! desktop apps) do not send `Origin`.

use std::borrow::Cow;
use std::sync::{Arc, RwLock};

use axum::http::request::Parts;
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, Implementation, InitializeResult,
    ListToolsResult, PaginatedRequestParams, ProtocolVersion, ServerCapabilities, ServerConfig,
};
use rmcp::service::{NotificationContext, RequestContext};
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use rmcp::{ErrorData as McpError, RoleServer, ServerHandler};
use serde::Serialize;
use serde_json::{Value, json};

use super::bridge::McpBridge;

/// Default port. Override with the `CLOUDY_CLIP_MCP_PORT` environment variable.
pub const DEFAULT_PORT: u16 = 7420;

/// Protocol versions the server speaks, newest first.
const SUPPORTED_VERSIONS: [ProtocolVersion; 3] = [
    ProtocolVersion::V_2025_11_25,
    ProtocolVersion::V_2025_06_18,
    ProtocolVersion::V_2025_03_26,
];

const INSTRUCTIONS: &str = "\
Cloudy Clip is a video editor. You edit the same live project the user sees, side by side with \
them. The user sees you as a collaborator and can undo your steps.
- Start with `project_get_state` to see compositions, media, tracks and clips.
- A project holds compositions, and each has its own tracks and clips. You have your own open \
composition, set by `composition_open`. An empty project has none: import media, then call \
`composition_create_from_media` or `composition_create`.
- All times are integer microseconds (1 s = 1000000).
- You have your own playhead: the `preview_*` tools move only yours, never the user's. \
`collab_get_user_context` tells you where the user is and what they selected.
- Use `preview_capture_frame` to look at the result. It works while the user does other things.
- `history_undo` and `history_redo` act only on your own steps. They are refused when someone \
changed the same thing afterwards.
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

/// The session id of a request, when its protocol version has sessions.
fn session_id(parts: Option<&Parts>) -> Option<&str> {
    parts?.headers.get("mcp-session-id")?.to_str().ok()
}

/// A client's name and version. Stateless requests get rmcp's own placeholder from `peer_info`,
/// so the request's `_meta` comes next, then the User-Agent.
fn client_identity(
    peer: Option<Implementation>,
    meta: Option<Implementation>,
    parts: Option<&Parts>,
) -> (String, Option<String>) {
    let placeholder = Implementation::default().name;
    if let Some(info) = peer.filter(|info| info.name != placeholder).or(meta) {
        return (info.name, Some(info.version));
    }
    let agent = parts
        .and_then(|p| p.headers.get("user-agent"))
        .and_then(|v| v.to_str().ok());
    (agent.unwrap_or("Agent").to_owned(), None)
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

    /// Stops at the last version with `initialize`. `2026-07-28` has no sessions, and nothing else
    /// in a request tells two instances of a client apart, so they would be one collaborator.
    fn supported_protocol_versions(&self) -> Cow<'static, [ProtocolVersion]> {
        Cow::Borrowed(&SUPPORTED_VERSIONS)
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, McpError> {
        serde_json::from_value(json!({ "tools": self.bridge.tools() }))
            .map_err(|e| McpError::internal_error(format!("Could not list tools: {e}"), None))
    }

    async fn on_initialized(&self, context: NotificationContext<RoleServer>) {
        let parts = context.extensions.get::<Parts>();
        let peer = context.peer.peer_info().map(|i| i.client_info.clone());
        let (name, version) = client_identity(peer, None, parts);
        match self.bridge.client(session_id(parts), name, version) {
            Ok(client) => self.bridge.announce(&client),
            Err(e) => eprintln!("[mcp] {e}"),
        }
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        context: RequestContext<RoleServer>,
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
        let parts = context.extensions.get::<Parts>();
        let peer = context.peer.peer_info().map(|i| i.client_info.clone());
        let (name, version) = client_identity(peer, context.meta.client_info(), parts);
        let caller = self
            .bridge
            .client(session_id(parts), name, version)
            .map_err(|e| McpError::internal_error(e.to_string(), None))?;
        let result = match self.bridge.call(&request.name, arguments, &caller).await {
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
