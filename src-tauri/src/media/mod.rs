//! Media module: file registration and the loopback media server.

pub mod commands;
pub mod registry;
pub mod server;

use std::sync::{Arc, RwLock};

use tauri::{App, Manager};

pub use registry::MediaRegistry;

/// Base URL of the media server once it is listening (`None` until then or if it failed).
#[derive(Default)]
pub struct MediaServerUrl(pub RwLock<Option<String>>);

/// Creates the registry and starts the media server in the background.
pub fn setup(app: &mut App) {
    let registry = Arc::new(MediaRegistry::default());
    app.manage(registry.clone());
    app.manage(MediaServerUrl::default());

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
