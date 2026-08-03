mod db_baseline;

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
        Migration {
            version: 3,
            description: "goal_repo_url",
            sql: include_str!("../migrations/0003_repo_url.sql"),
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
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Must resolve to the exact same path tauri-plugin-sql itself will
            // open (app_config_dir()/DATABASE_FILE) and must run before the
            // frontend ever calls Database.load(), which is what triggers the
            // plugin's own migration run.
            let db_path = app.path().app_config_dir()?.join(DATABASE_FILE);
            tauri::async_runtime::block_on(db_baseline::baseline_if_needed(&db_path))?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
