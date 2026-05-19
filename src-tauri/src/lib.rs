use std::fs;
use tauri::{Emitter, Manager};
#[cfg(target_os = "macos")]
use tauri::{RunEvent, WindowEvent};

#[cfg(target_os = "macos")]
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
fn show_capture_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("capture") {
        let _ = window.show();
        let _ = window.set_always_on_top(true);
        let _ = window.center();
        let _ = window.set_focus();
        let _ = app.emit("capture:focus", ());
    }
}

fn register_capture_shortcut(app: &tauri::AppHandle, shortcut: Shortcut) -> Result<(), String> {
    let handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                show_capture_window(&handle);
            }
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn show_capture(app: tauri::AppHandle) {
    show_capture_window(&app);
}

#[tauri::command]
fn register_shortcut(app: tauri::AppHandle, accelerator: String) -> Result<(), String> {
    app.global_shortcut().unregister_all().map_err(|e| e.to_string())?;
    let shortcut = parse_accelerator(&accelerator)?;
    register_capture_shortcut(&app, shortcut)
}

#[tauri::command]
fn get_db_path(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    Ok(dir.join("personal_spine.db").to_string_lossy().into_owned())
}

#[tauri::command]
fn export_database(app: tauri::AppHandle, destination: String) -> Result<(), String> {
    let source = get_db_path(app.clone())?;
    fs::copy(&source, &destination)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn import_database(app: tauri::AppHandle, source: String) -> Result<(), String> {
    let destination = get_db_path(app)?;
    fs::copy(&source, &destination)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn parse_accelerator(accelerator: &str) -> Result<Shortcut, String> {
    let parts: Vec<&str> = accelerator.split('+').map(str::trim).collect();
    if parts.is_empty() {
        return Err("Empty accelerator".into());
    }

    let key_str = parts
        .last()
        .ok_or_else(|| "Missing key".to_string())?
        .to_uppercase();

    let mut modifiers = Modifiers::empty();
    for part in &parts[..parts.len() - 1] {
        match part.to_uppercase().as_str() {
            "ALT" => modifiers |= Modifiers::ALT,
            "CONTROL" | "CTRL" => modifiers |= Modifiers::CONTROL,
            "SHIFT" => modifiers |= Modifiers::SHIFT,
            "SUPER" | "WIN" | "META" => modifiers |= Modifiers::SUPER,
            other => return Err(format!("Unknown modifier: {other}")),
        }
    }

    let code = match key_str.as_str() {
        "SPACE" => Code::Space,
        "ENTER" => Code::Enter,
        "ESCAPE" | "ESC" => Code::Escape,
        "A" => Code::KeyA,
        "B" => Code::KeyB,
        "C" => Code::KeyC,
        "D" => Code::KeyD,
        "E" => Code::KeyE,
        "F" => Code::KeyF,
        "G" => Code::KeyG,
        "H" => Code::KeyH,
        "I" => Code::KeyI,
        "J" => Code::KeyJ,
        "K" => Code::KeyK,
        "L" => Code::KeyL,
        "M" => Code::KeyM,
        "N" => Code::KeyN,
        "O" => Code::KeyO,
        "P" => Code::KeyP,
        "Q" => Code::KeyQ,
        "R" => Code::KeyR,
        "S" => Code::KeyS,
        "T" => Code::KeyT,
        "U" => Code::KeyU,
        "V" => Code::KeyV,
        "W" => Code::KeyW,
        "X" => Code::KeyX,
        "Y" => Code::KeyY,
        "Z" => Code::KeyZ,
        other => return Err(format!("Unsupported key: {other}")),
    };

    Ok(Shortcut::new(Some(modifiers), code))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            show_capture,
            register_shortcut,
            get_db_path,
            export_database,
            import_database
        ])
        .setup(|app| {
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.show();
                let _ = main_win.unminimize();
                let _ = main_win.set_focus();

                #[cfg(target_os = "macos")]
                {
                    let main_for_close = main_win.clone();
                    main_win.on_window_event(move |event| {
                        if let WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = main_for_close.hide();
                        }
                    });
                }
            }

            let handle = app.handle().clone();
            let default =
                Shortcut::new(Some(Modifiers::ALT | Modifiers::SHIFT), Code::Space);
            let fallbacks = [
                default,
                Shortcut::new(
                    Some(Modifiers::CONTROL | Modifiers::ALT),
                    Code::Space,
                ),
                Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space),
            ];

            let mut registered = false;
            let mut last_error = String::new();
            for shortcut in fallbacks {
                let _ = handle.global_shortcut().unregister_all();
                match register_capture_shortcut(&handle, shortcut) {
                    Ok(()) => {
                        registered = true;
                        break;
                    }
                    Err(err) => last_error = err,
                }
            }

            if !registered {
                eprintln!("Failed to register capture shortcut: {last_error}");
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { has_visible_windows, .. } = event {
                if !has_visible_windows {
                    show_main_window(app_handle);
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app_handle, event);
        });
}
