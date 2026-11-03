//! Media module: file registration, editing proxies, and the loopback media server.

pub mod commands;
pub(crate) mod denoise;
pub(crate) mod derived;
pub mod disks;
pub mod facts;
mod image;
pub mod proxy;
pub mod registry;
pub(crate) mod reversed;
pub mod server;

use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use tauri::{App, Manager, Runtime};

pub use registry::MediaRegistry;

/// Base URL of the media server once it is listening (`None` until then or if it failed).
#[derive(Default)]
pub struct MediaServerUrl(pub RwLock<Option<String>>);

/// The app's cache folder, where proxies and derived files go (and recordings of a project that
/// has no folder yet); the system's temporary folder when there is none.
pub fn cache_root<R: Runtime>(app: &impl Manager<R>) -> PathBuf {
    app.path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("cloudy-clip"))
}

/// Creates the registry and proxy jobs, and starts the media server in the background.
pub fn setup(app: &mut App) {
    let registry = Arc::new(MediaRegistry::default());
    app.manage(registry.clone());
    app.manage(MediaServerUrl::default());

    app.manage(proxy::ProxyJobs::new(cache_root(app).join("proxies")));

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
