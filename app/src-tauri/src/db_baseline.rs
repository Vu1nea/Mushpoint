//! One-time compatibility shim for databases created by the pre-migration Rust
//! backend, which tracked schema version via `PRAGMA user_version`.
//! tauri-plugin-sql (via sqlx) tracks it in a `_sqlx_migrations` bookkeeping
//! table instead. Without this, sqlx sees zero migrations applied and replays
//! migration 1 against tables that already exist, failing every launch. This
//! runs once, before the frontend ever calls `Database.load()`, and backs the
//! file up first.

use sha2::{Digest, Sha384};
use sqlx::sqlite::{SqliteConnectOptions, SqliteConnection};
use sqlx::{ConnectOptions, Connection};
use std::path::Path;

/// If `path` is a database from before this app's move to tauri-plugin-sql
/// (its tables exist, but it has no `_sqlx_migrations` bookkeeping table yet),
/// records the two shipped migrations as already applied so sqlx's migrator
/// skips replaying them. Backs the file up first. A no-op for a fresh install
/// or an already-baselined database.
pub async fn baseline_if_needed(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if !path.exists() {
        return Ok(());
    }

    let mut conn = SqliteConnectOptions::new().filename(path).connect().await?;
    let already_baselined = table_exists(&mut conn, "_sqlx_migrations").await?;
    let has_old_schema = table_exists(&mut conn, "categories").await?;
    conn.close().await?;

    if already_baselined || !has_old_schema {
        return Ok(());
    }

    let backup_path = {
        let mut name = path
            .file_name()
            .expect("database path has a filename")
            .to_os_string();
        name.push(".pre-ts-migration.bak");
        path.with_file_name(name)
    };
    if !backup_path.exists() {
        std::fs::copy(path, &backup_path)?;
        log::info!("backed up pre-existing database to {}", backup_path.display());
    }

    let mut conn = SqliteConnectOptions::new().filename(path).connect().await?;

    // Exact schema sqlx's SQLite migrator expects — see sqlx-sqlite's
    // `impl Migrate for SqliteConnection::ensure_migrations_table`.
    sqlx::query(
        r#"
CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version BIGINT PRIMARY KEY,
    description TEXT NOT NULL,
    installed_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN NOT NULL,
    checksum BLOB NOT NULL,
    execution_time BIGINT NOT NULL
);
"#,
    )
    .execute(&mut conn)
    .await?;

    insert_baseline_row(
        &mut conn,
        1,
        "initial",
        include_str!("../migrations/0001_initial.sql"),
    )
    .await?;
    insert_baseline_row(
        &mut conn,
        2,
        "streaks",
        include_str!("../migrations/0002_streaks.sql"),
    )
    .await?;

    conn.close().await?;
    log::info!(
        "baselined pre-existing database at {} for sqlx migration tracking",
        path.display()
    );
    Ok(())
}

async fn table_exists(
    conn: &mut SqliteConnection,
    name: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let row = sqlx::query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1")
        .bind(name)
        .fetch_optional(conn)
        .await?;
    Ok(row.is_some())
}

/// Checksum matches exactly what `sqlx::migrate::Migration::new` computes —
/// SHA-384 over the raw migration SQL bytes — so sqlx's migrator sees this
/// migration as already applied and never re-runs it.
async fn insert_baseline_row(
    conn: &mut SqliteConnection,
    version: i64,
    description: &str,
    sql: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let checksum = Sha384::digest(sql.as_bytes()).to_vec();
    sqlx::query(
        "INSERT OR IGNORE INTO _sqlx_migrations (version, description, success, checksum, execution_time) \
         VALUES (?1, ?2, 1, ?3, 0)",
    )
    .bind(version)
    .bind(description)
    .bind(checksum)
    .execute(conn)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn old_scheme_db(path: &Path) {
        let mut conn = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .connect()
            .await
            .unwrap();
        sqlx::query(include_str!("../migrations/0001_initial.sql"))
            .execute(&mut conn)
            .await
            .unwrap();
        sqlx::query(include_str!("../migrations/0002_streaks.sql"))
            .execute(&mut conn)
            .await
            .unwrap();
        sqlx::query("PRAGMA user_version = 2")
            .execute(&mut conn)
            .await
            .unwrap();
        conn.close().await.unwrap();
    }

    #[test]
    fn baselines_a_pre_migration_database_without_losing_data() {
        let dir = std::env::temp_dir().join(format!(
            "mushtrack-baseline-test-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("old.sqlite3");
        let _ = std::fs::remove_file(&path);

        tauri::async_runtime::block_on(async {
            old_scheme_db(&path).await;

            baseline_if_needed(&path).await.unwrap();

            let mut conn = SqliteConnectOptions::new()
                .filename(&path)
                .connect()
                .await
                .unwrap();

            let rows: Vec<(i64, Vec<u8>)> = sqlx::query_as(
                "SELECT version, checksum FROM _sqlx_migrations ORDER BY version",
            )
            .fetch_all(&mut conn)
            .await
            .unwrap();

            assert_eq!(rows.len(), 2);
            assert_eq!(rows[0].0, 1);
            assert_eq!(
                rows[0].1,
                Sha384::digest(include_str!("../migrations/0001_initial.sql").as_bytes())
                    .to_vec()
            );
            assert_eq!(rows[1].0, 2);
            assert_eq!(
                rows[1].1,
                Sha384::digest(include_str!("../migrations/0002_streaks.sql").as_bytes())
                    .to_vec()
            );

            let categories: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM categories")
                .fetch_one(&mut conn)
                .await
                .unwrap();
            assert_eq!(categories.0, 5, "seeded categories must survive baselining");

            conn.close().await.unwrap();
        });

        let backup = path.with_file_name("old.sqlite3.pre-ts-migration.bak");
        assert!(backup.exists(), "a backup of the original file must be created");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn is_a_no_op_for_a_fresh_install() {
        let dir = std::env::temp_dir().join(format!(
            "mushtrack-baseline-fresh-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("fresh.sqlite3");
        let _ = std::fs::remove_file(&path);

        tauri::async_runtime::block_on(async {
            baseline_if_needed(&path).await.unwrap();
        });

        assert!(!path.exists(), "must not create a database file itself");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn is_a_no_op_for_an_already_baselined_database() {
        let dir = std::env::temp_dir().join(format!(
            "mushtrack-baseline-idempotent-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("baselined.sqlite3");
        let _ = std::fs::remove_file(&path);

        tauri::async_runtime::block_on(async {
            old_scheme_db(&path).await;
            baseline_if_needed(&path).await.unwrap();
            // Running it again must not error or duplicate rows.
            baseline_if_needed(&path).await.unwrap();

            let mut conn = SqliteConnectOptions::new()
                .filename(&path)
                .connect()
                .await
                .unwrap();
            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM _sqlx_migrations")
                .fetch_one(&mut conn)
                .await
                .unwrap();
            assert_eq!(count.0, 2);
            conn.close().await.unwrap();
        });

        std::fs::remove_dir_all(&dir).ok();
    }

    /// Reproduces exactly what tauri-plugin-sql does when the frontend calls
    /// `Database.load()`: build a `sqlx::migrate::Migrator` from the same two
    /// migrations and `.run()` it against the pool. Before the fix this fails
    /// with "table categories already exists"; this test proves the baselined
    /// database makes the real migrator skip both migrations cleanly.
    #[derive(Debug)]
    struct TestMigrations(Vec<sqlx::migrate::Migration>);

    impl sqlx::migrate::MigrationSource<'static> for TestMigrations {
        fn resolve(
            self,
        ) -> futures_core::future::BoxFuture<
            'static,
            Result<Vec<sqlx::migrate::Migration>, sqlx::error::BoxDynError>,
        > {
            Box::pin(async move { Ok(self.0) })
        }
    }

    #[test]
    fn the_real_sqlx_migrator_accepts_a_baselined_database() {
        let dir = std::env::temp_dir().join(format!(
            "mushtrack-baseline-migrator-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("real_migrator.sqlite3");
        let _ = std::fs::remove_file(&path);

        tauri::async_runtime::block_on(async {
            old_scheme_db(&path).await;
            baseline_if_needed(&path).await.unwrap();

            let pool = sqlx::SqlitePool::connect_with(
                SqliteConnectOptions::new().filename(&path),
            )
            .await
            .unwrap();

            let migrations = vec![
                sqlx::migrate::Migration::new(
                    1,
                    "initial".into(),
                    sqlx::migrate::MigrationType::ReversibleUp,
                    include_str!("../migrations/0001_initial.sql").into(),
                    false,
                ),
                sqlx::migrate::Migration::new(
                    2,
                    "streaks".into(),
                    sqlx::migrate::MigrationType::ReversibleUp,
                    include_str!("../migrations/0002_streaks.sql").into(),
                    false,
                ),
            ];

            let migrator = sqlx::migrate::Migrator::new(TestMigrations(migrations))
                .await
                .unwrap();

            // Before the fix, this errors with "table categories already
            // exists" because sqlx sees zero applied migrations and replays
            // migration 1 against a database that already has the schema.
            migrator
                .run(&pool)
                .await
                .expect("migrator must skip both migrations, not replay them");

            let categories: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM categories")
                .fetch_one(&pool)
                .await
                .unwrap();
            assert_eq!(categories.0, 5, "data must survive the real migrator run");

            pool.close().await;
        });

        std::fs::remove_dir_all(&dir).ok();
    }
}
