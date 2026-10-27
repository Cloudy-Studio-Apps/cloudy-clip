//! Loopback HTTP server that streams registered files to the webview, with Range support.
//!
//! Why HTTP and not a custom URI scheme: on Linux, WebKitGTK's GStreamer media pipeline cannot
//! read from custom schemes (it requests the first bytes, then fails), while every webview's
//! media stack handles plain HTTP natively, including seeking via Range requests.
//!
//! Safety:
//! - Bound to `127.0.0.1` on a random port; only loopback `Host` headers are accepted.
//! - Every URL carries a random per-session token, so other local pages or processes cannot
//!   guess media URLs.
//! - Only files registered through `media_register` (by id) are served; never raw paths.
//!
//! Media elements request byte ranges as they play and seek. Bodies are streamed from disk in
//! [`STREAM_BUFFER`]-sized pieces, so memory stays flat however large the file or range is.

use std::io::SeekFrom;
use std::path::Path;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Path as UrlPath, State};
use axum::http::{HeaderMap, Method, Response, StatusCode, header};
use axum::routing::any;
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use super::registry::{MediaRegistry, mime_of};
use crate::error::{AppError, AppResult};

/// Read buffer for streamed bodies.
const STREAM_BUFFER: usize = 256 * 1024;

#[derive(Clone)]
struct ServerState {
    registry: Arc<MediaRegistry>,
    token: Arc<str>,
}

/// Where the webview fetches media: `<base_url>/<media id>`.
pub struct MediaServer {
    pub base_url: String,
}

/// Binds the server on a random loopback port and serves in the background.
pub async fn start(registry: Arc<MediaRegistry>) -> AppResult<MediaServer> {
    let token = random_token()?;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();

    let state = ServerState {
        registry,
        token: token.clone().into(),
    };
    let router = axum::Router::new()
        .route("/media/{token}/{id}", any(handle))
        .with_state(state);
    tauri::async_runtime::spawn(async move {
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("[media] server stopped: {e}");
        }
    });

    Ok(MediaServer {
        base_url: format!("http://127.0.0.1:{port}/media/{token}"),
    })
}

fn random_token() -> AppResult<String> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes)
        .map_err(|e| AppError::Unavailable(format!("No randomness available: {e}")))?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

async fn handle(
    State(state): State<ServerState>,
    UrlPath((token, id)): UrlPath<(String, String)>,
    method: Method,
    headers: HeaderMap,
) -> Response<Body> {
    if !is_loopback_host(&headers) {
        return error(StatusCode::FORBIDDEN, "Forbidden host");
    }
    if token != *state.token {
        return error(StatusCode::NOT_FOUND, "Not found");
    }
    if method == Method::OPTIONS {
        return respond(
            with_cors(Response::builder().status(StatusCode::NO_CONTENT)),
            Vec::new(),
        );
    }
    if method != Method::GET && method != Method::HEAD {
        return error(StatusCode::METHOD_NOT_ALLOWED, "Method not allowed");
    }
    let Some(path) = state.registry.playback_path_of(&id) else {
        return error(StatusCode::NOT_FOUND, "Unknown media id");
    };

    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    match read_range(&path, range, method == Method::HEAD).await {
        Ok(response) => response,
        Err(e) => error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()),
    }
}

/// DNS-rebinding guard: only `127.0.0.1` / `localhost` hosts.
fn is_loopback_host(headers: &HeaderMap) -> bool {
    let Some(host) = headers.get(header::HOST).and_then(|h| h.to_str().ok()) else {
        return false;
    };
    let name = host.rsplit_once(':').map_or(host, |(name, _)| name);
    matches!(name, "127.0.0.1" | "localhost" | "[::1]")
}

async fn read_range(
    path: &Path,
    range: Option<&str>,
    head_only: bool,
) -> std::io::Result<Response<Body>> {
    let mut file = tokio::fs::File::open(path).await?;
    let size = file.metadata().await?.len();

    let (start, end, partial) = match range.map(|r| parse_range(r, size)) {
        Some(Some((start, end))) => (start, end, true),
        Some(None) => {
            return Ok(respond(
                with_cors(Response::builder().status(StatusCode::RANGE_NOT_SATISFIABLE))
                    .header(header::CONTENT_RANGE, format!("bytes */{size}")),
                Vec::new(),
            ));
        }
        None => (0, size.saturating_sub(1), false),
    };
    let len = if size == 0 { 0 } else { end - start + 1 };

    let builder = with_cors(Response::builder())
        .header(header::CONTENT_TYPE, mime_of(path))
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::CONTENT_LENGTH, len.to_string())
        .header(header::CACHE_CONTROL, "no-store");
    let builder = if partial {
        builder
            .status(StatusCode::PARTIAL_CONTENT)
            .header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{size}"))
    } else {
        builder.status(StatusCode::OK)
    };

    if head_only || len == 0 {
        return Ok(respond(builder, Vec::new()));
    }
    file.seek(SeekFrom::Start(start)).await?;
    let stream = ReaderStream::with_capacity(file.take(len), STREAM_BUFFER);
    Ok(builder.body(Body::from_stream(stream)).unwrap_or_default())
}

/// Parses a single `bytes=` range. Returns inclusive bounds, or `None` if unsatisfiable.
/// Multi-range requests are answered with their first range.
fn parse_range(header: &str, size: u64) -> Option<(u64, u64)> {
    let spec = header.strip_prefix("bytes=")?.split(',').next()?.trim();
    let (start, end) = spec.split_once('-')?;
    if size == 0 {
        return None;
    }
    let last = size - 1;
    let bounds = match (start.trim(), end.trim()) {
        ("", suffix) => {
            let n: u64 = suffix.parse().ok()?;
            if n == 0 {
                return None;
            }
            (size.saturating_sub(n), last)
        }
        (start, "") => (start.parse().ok()?, last),
        (start, end) => (start.parse().ok()?, end.parse::<u64>().ok()?.min(last)),
    };
    (bounds.0 <= bounds.1 && bounds.0 <= last).then_some(bounds)
}

/// Allows canvas reads of frames (`crossOrigin = "anonymous"` media elements).
fn with_cors(builder: axum::http::response::Builder) -> axum::http::response::Builder {
    builder
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range")
        .header(
            header::ACCESS_CONTROL_EXPOSE_HEADERS,
            "Content-Range, Content-Length, Accept-Ranges",
        )
}

fn respond(builder: axum::http::response::Builder, body: Vec<u8>) -> Response<Body> {
    builder.body(Body::from(body)).unwrap_or_default()
}

fn error(status: StatusCode, message: &str) -> Response<Body> {
    respond(
        with_cors(Response::builder().status(status)).header(header::CONTENT_TYPE, "text/plain"),
        message.as_bytes().to_vec(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ranges() {
        assert_eq!(parse_range("bytes=0-", 100), Some((0, 99)));
        assert_eq!(parse_range("bytes=10-19", 100), Some((10, 19)));
        assert_eq!(parse_range("bytes=90-200", 100), Some((90, 99)));
        assert_eq!(parse_range("bytes=-10", 100), Some((90, 99)));
        assert_eq!(parse_range("bytes=0-0,5-6", 100), Some((0, 0)));
    }

    #[test]
    fn rejects_unsatisfiable_ranges() {
        assert_eq!(parse_range("bytes=100-", 100), None);
        assert_eq!(parse_range("bytes=20-10", 100), None);
        assert_eq!(parse_range("bytes=-0", 100), None);
        assert_eq!(parse_range("items=0-1", 100), None);
        assert_eq!(parse_range("bytes=0-", 0), None);
    }

    #[test]
    fn accepts_only_loopback_hosts() {
        let mut headers = HeaderMap::new();
        headers.insert(header::HOST, "127.0.0.1:5000".parse().unwrap());
        assert!(is_loopback_host(&headers));
        headers.insert(header::HOST, "evil.example:5000".parse().unwrap());
        assert!(!is_loopback_host(&headers));
        assert!(!is_loopback_host(&HeaderMap::new()));
    }
}
