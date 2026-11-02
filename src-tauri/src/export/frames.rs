//! Loopback route that takes frames from the webview.
//!
//! A frame is megabytes of raw pixels, too much for the JSON path Tauri's IPC takes on Linux, so
//! it travels like media does: plain HTTP on `127.0.0.1`. Same guards as the media server: a
//! random port, loopback `Host` only, and a job id nobody can guess.

use std::sync::Arc;

use axum::body::{Body, Bytes};
use axum::extract::{DefaultBodyLimit, Path, State};
use axum::http::{HeaderMap, Method, Response, StatusCode, header};
use axum::routing::any;

use super::Jobs;
use crate::error::AppResult;
use crate::media::server::is_loopback_host;

/// Largest frame taken: 8K RGBA.
const MAX_FRAME_BYTES: usize = 7680 * 4320 * 4;

/// Listens on a random loopback port. Returns the base URL of the route.
pub async fn start(jobs: Arc<Jobs>) -> AppResult<String> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let router = axum::Router::new()
        .route("/export/{job}", any(handle))
        .layer(DefaultBodyLimit::max(MAX_FRAME_BYTES))
        .with_state(jobs);
    tauri::async_runtime::spawn(async move {
        if let Err(e) = axum::serve(listener, router).await {
            eprintln!("[export] frame route stopped: {e}");
        }
    });
    Ok(format!("http://127.0.0.1:{port}/export"))
}

fn respond(status: StatusCode, message: &str) -> Response<Body> {
    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "POST")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Content-Type")
        .body(Body::from(message.to_owned()))
        .unwrap_or_default()
}

async fn handle(
    State(jobs): State<Arc<Jobs>>,
    Path(job): Path<String>,
    method: Method,
    headers: HeaderMap,
    frame: Bytes,
) -> Response<Body> {
    if !is_loopback_host(&headers) {
        return respond(StatusCode::FORBIDDEN, "Forbidden host");
    }
    let Some(job) = jobs.get(&job) else {
        return respond(StatusCode::NOT_FOUND, "No such export");
    };
    if method == Method::OPTIONS {
        return respond(StatusCode::NO_CONTENT, "");
    }
    if method != Method::POST {
        return respond(StatusCode::METHOD_NOT_ALLOWED, "Method not allowed");
    }
    match job.write_frame(&frame).await {
        Ok(()) => respond(StatusCode::NO_CONTENT, ""),
        Err(message) => respond(StatusCode::INTERNAL_SERVER_ERROR, &message),
    }
}
