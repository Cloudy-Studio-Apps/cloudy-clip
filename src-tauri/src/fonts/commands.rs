//! Tauri commands of the fonts module.

use std::sync::OnceLock;

use serde::Serialize;

/// One installed face, as the font picker lists it.
#[derive(Serialize)]
pub struct SystemFont {
    family: String,
    weight: u16,
    italic: bool,
}

/// The installed faces, scanned once (scanning the font folders takes a moment).
fn database() -> &'static fontdb::Database {
    static DATABASE: OnceLock<fontdb::Database> = OnceLock::new();
    DATABASE.get_or_init(|| {
        let mut db = fontdb::Database::new();
        db.load_system_fonts();
        db
    })
}

/// Every installed face (several per family). Scanning runs off the main thread.
#[tauri::command]
pub async fn fonts_system_list() -> Vec<SystemFont> {
    tauri::async_runtime::spawn_blocking(|| {
        database()
            .faces()
            .filter_map(|face| {
                let (family, _) = face.families.first()?;
                Some(SystemFont {
                    family: family.clone(),
                    weight: face.weight.0,
                    italic: face.style != fontdb::Style::Normal,
                })
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}
