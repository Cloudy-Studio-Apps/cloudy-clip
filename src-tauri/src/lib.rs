//! Cloudy Clip native side. `lib.rs` only wires modules; each module lives in its own folder.

mod error;
mod fonts;
mod mcp;
mod media;
mod webview;
mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            media::setup(app);
            mcp::setup(app);
            webview::setup(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fonts::commands::fonts_system_list,
            media::commands::media_register,
            media::commands::media_server_url,
            media::commands::media_stat,
            mcp::commands::mcp_register_tools,
            mcp::commands::mcp_respond,
            mcp::commands::mcp_status,
            workspace::commands::workspace_exists,
            workspace::commands::workspace_read,
            workspace::commands::workspace_recents_read,
            workspace::commands::workspace_recents_write,
            workspace::commands::workspace_rename,
            workspace::commands::workspace_unique_path,
            workspace::commands::workspace_write,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("error while running Cloudy Clip: {error}");
        std::process::exit(1);
    }
}
