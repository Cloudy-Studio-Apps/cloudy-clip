//! Webview workarounds for WebKitGTK (Linux).
//!
//! WebKitGTK 2.54 repaints only the part of a layer it thinks changed ("damage"). For the
//! preview canvas that area comes out too narrow: a strip at the right of the video keeps an
//! old frame (or black) on screen while the canvas pixels are right. Turning damage
//! propagation off makes WebKit repaint whole layers, which costs little for this UI.

use tauri::App;

/// Set to `1` to keep WebKit's damage tracking (to check whether a WebKit update fixed it).
#[cfg(target_os = "linux")]
const OPT_OUT_VAR: &str = "CLOUDY_CLIP_WEBKIT_DAMAGE";

/// Applies the workarounds to every webview window of the app.
pub fn setup(app: &App) {
    #[cfg(target_os = "linux")]
    {
        use tauri::Manager;
        if std::env::var(OPT_OUT_VAR).is_ok_and(|v| v == "1") {
            return;
        }
        for window in app.webview_windows().values() {
            let result = window.with_webview(|webview| {
                use webkit2gtk::WebViewExt;
                if let Some(settings) = webview.inner().settings() {
                    linux::disable_damage_tracking(&settings);
                }
            });
            if let Err(e) = result {
                eprintln!("[webview] could not configure the webview: {e}");
            }
        }
    }
    #[cfg(not(target_os = "linux"))]
    let _ = app;
}

#[cfg(target_os = "linux")]
mod linux {
    use std::ffi::{CStr, c_char, c_int, c_void};

    use webkit2gtk::glib::translate::ToGlibPtr;

    /// WebKit features that drive partial repaints.
    const DISABLED_FEATURES: &[&str] = &[
        "PropagateDamagingInformation",
        "UseDamagingInformationForCompositing",
    ];

    // The feature API (WebKitGTK ≥ 2.42) is not in the `webkit2gtk` bindings.
    #[link(name = "webkit2gtk-4.1")]
    unsafe extern "C" {
        fn webkit_settings_get_all_features() -> *mut c_void;
        fn webkit_feature_list_get_length(list: *mut c_void) -> usize;
        fn webkit_feature_list_get(list: *mut c_void, index: usize) -> *mut c_void;
        fn webkit_feature_list_unref(list: *mut c_void);
        fn webkit_feature_get_identifier(feature: *mut c_void) -> *const c_char;
        fn webkit_settings_set_feature_enabled(
            settings: *mut webkit2gtk::ffi::WebKitSettings,
            feature: *mut c_void,
            enabled: c_int,
        );
    }

    pub fn disable_damage_tracking(settings: &webkit2gtk::Settings) {
        let settings_ptr: *mut webkit2gtk::ffi::WebKitSettings = settings.to_glib_none().0;
        // SAFETY: the list is owned by us until unref; features are borrowed from it, and the
        // settings pointer stays valid while `settings` is borrowed.
        unsafe {
            let list = webkit_settings_get_all_features();
            if list.is_null() {
                return;
            }
            for index in 0..webkit_feature_list_get_length(list) {
                let feature = webkit_feature_list_get(list, index);
                let id = webkit_feature_get_identifier(feature);
                if id.is_null() {
                    continue;
                }
                let id = CStr::from_ptr(id).to_string_lossy();
                if DISABLED_FEATURES.contains(&id.as_ref()) {
                    webkit_settings_set_feature_enabled(settings_ptr, feature, 0);
                }
            }
            webkit_feature_list_unref(list);
        }
    }
}
