#[macro_use]
mod commands;
mod db;
mod error;
mod models;
mod progress;
mod repo;
mod streak;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_FILE: &str = "mushpoint.sqlite3";

/// Connection string shared with the JS side (`app/src/lib/db/connection.ts`) —
/// tauri-plugin-sql keys registered migrations by this exact string, so it must
/// match on both sides verbatim.
const SQL_CONNECTION: &str = "sqlite:mushpoint.sqlite3";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "streaks",
            sql: include_str!("../migrations/0002_streaks.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(SQL_CONNECTION, migrations())
                .build(),
        )
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
