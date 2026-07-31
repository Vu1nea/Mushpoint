#[macro_use]
mod commands;
mod db;
mod error;
mod models;
mod progress;
mod repo;

use tauri::Manager;

const DATABASE_FILE: &str = "mushpoint.sqlite3";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Per-OS app data dir, so the database survives app updates and is a
            // single file the user can copy as a backup.
            let path = app.path().app_data_dir()?.join(DATABASE_FILE);
            log::info!("opening database at {}", path.display());
            app.manage(db::Db::new(db::open(&path)?));

            Ok(())
        })
        .invoke_handler(command_handlers!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
