use rusqlite::{params, Connection};

use super::now;
use crate::error::{Error, Result};
use crate::models::Settings;

/// Themes the app ships with. The frontend maps each name to a token set; the
/// backend only guards that an unknown name never gets persisted.
pub const THEMES: &[&str] = &["nocturne", "coquette"];

pub fn get(conn: &Connection) -> Result<Settings> {
    let settings = conn.query_row(
        "SELECT active_theme, updated_at FROM settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                active_theme: row.get("active_theme")?,
                updated_at: row.get("updated_at")?,
            })
        },
    )?;
    Ok(settings)
}

/// Just the grace number, for the streak math. Read on every streak computation
/// so changing it in Settings updates every card immediately.
pub fn grace_days(conn: &Connection) -> Result<i64> {
    let grace = conn.query_row(
        "SELECT streak_grace_days FROM settings WHERE id = 1",
        [],
        |row| row.get(0),
    )?;
    Ok(grace)
}

pub fn set_theme(conn: &Connection, theme: &str) -> Result<Settings> {
    if !THEMES.contains(&theme) {
        return Err(Error::Validation(format!("unknown theme: {theme}")));
    }

    conn.execute(
        "UPDATE settings SET active_theme = ?1, updated_at = ?2 WHERE id = 1",
        params![theme, now()],
    )?;

    get(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn defaults_to_nocturne() {
        let conn = db::open_in_memory().unwrap();
        assert_eq!(get(&conn).unwrap().active_theme, "nocturne");
    }

    #[test]
    fn switches_to_a_known_theme() {
        let conn = db::open_in_memory().unwrap();
        set_theme(&conn, "coquette").unwrap();

        assert_eq!(get(&conn).unwrap().active_theme, "coquette");
    }

    #[test]
    fn rejects_an_unknown_theme() {
        let conn = db::open_in_memory().unwrap();
        let err = set_theme(&conn, "vaporwave").unwrap_err();

        assert_eq!(err.kind(), "validation");
        assert_eq!(get(&conn).unwrap().active_theme, "nocturne");
    }
}
