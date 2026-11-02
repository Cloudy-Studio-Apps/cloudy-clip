//! Media module: file registration, editing proxies, and the loopback media server.

pub mod commands;
pub mod disks;
pub mod facts;
mod image;
pub mod proxy;
pub mod registry;
pub mod server;

use std::sync::{Arc, RwLock};

use tauri::{App, Manager};

pub use registry::MediaRegistry;

/// Base URL of the media server once it is listening (`None` until then or if it failed).
#[derive(Default)]
pub struct MediaServerUrl(pub RwLock<Option<String>>);

/// Creates the registry and proxy jobs, and starts the media server in the background.
pub fn setup(app: &mut App) {
    let registry = Arc::new(MediaRegistry::default());
    app.manage(registry.clone());
    app.manage(MediaServerUrl::default());

    let cache_dir = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("cloudy-clip"))
        .join("proxies");
    app.manage(proxy::ProxyJobs::new(cache_dir));

    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        match server::start(registry).await {
            Ok(media) => {
                if let Ok(mut url) = handle.state::<MediaServerUrl>().0.write() {
                    *url = Some(media.base_url);
                }
            }
            Err(e) => eprintln!("[media] could not start the media server: {e}"),
        }
    });
}
