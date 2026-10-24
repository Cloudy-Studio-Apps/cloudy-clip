//! Cloudy Clip native side. `lib.rs` only wires modules; each module lives in its own folder.

mod error;
mod mcp;
mod media;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            media::setup(app);
            mcp::setup(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            media::commands::media_register,
            media::commands::media_server_url,
            mcp::commands::mcp_register_tools,
            mcp::commands::mcp_respond,
            mcp::commands::mcp_status,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("error while running Cloudy Clip: {error}");
        std::process::exit(1);
    }
}
