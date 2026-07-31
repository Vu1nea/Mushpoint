pub mod migrations;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::Result;

/// The one live connection, guarded for use as Tauri managed state. SQLite is
/// fast enough locally that a single connection behind a mutex is simpler than
/// a pool and removes any write-contention question.
pub struct Db(pub Mutex<Connection>);

impl Db {
    pub fn new(conn: Connection) -> Self {
        Db(Mutex::new(conn))
    }

    /// Runs `f` with the connection. Panics only if a previous holder panicked
    /// mid-write, which would mean the database state is already untrustworthy.
    pub fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let conn = self.0.lock().expect("database mutex poisoned");
        f(&conn)
    }
}

/// Opens (creating if needed) the database file and brings its schema up to date.
pub fn open(path: &Path) -> Result<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut conn = Connection::open(path)?;
    configure(&conn)?;
    migrations::run(&mut conn)?;
    Ok(conn)
}

/// A migrated, throwaway database for tests.
#[cfg(test)]
pub fn open_in_memory() -> Result<Connection> {
    let mut conn = Connection::open_in_memory()?;
    configure(&conn)?;
    migrations::run(&mut conn)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> Result<()> {
    // Foreign keys are off by default in SQLite; the schema leans on ON DELETE rules.
    conn.pragma_update(None, "foreign_keys", "ON")?;
    // `journal_mode` reports the mode it settled on (in-memory databases stay
    // "memory"), so it has to be read back rather than plain-executed.
    conn.pragma_update_and_check(None, "journal_mode", "WAL", |_| Ok(()))?;
    Ok(())
}
