//! The completion log — one row per day a recurring task was done. This is the
//! source of truth; streak counters are always derived from it, never stored.

use std::collections::HashSet;

use chrono::NaiveDate;
use rusqlite::{params, Connection};

use super::now;
use crate::error::Result;

/// SQLite has no date type; `completed_on` is stored in this format so plain
/// string comparison sorts and ranges correctly.
pub const DATE_FORMAT: &str = "%Y-%m-%d";

pub fn format(date: NaiveDate) -> String {
    date.format(DATE_FORMAT).to_string()
}

/// Logs or unlogs one day. Logging a day twice is a no-op rather than an error —
/// the UI toggle should be safe to double-click.
pub fn set(conn: &Connection, task_id: i64, on: NaiveDate, done: bool) -> Result<()> {
    if done {
        conn.execute(
            "INSERT INTO task_completions (task_id, completed_on, created_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT (task_id, completed_on) DO NOTHING",
            params![task_id, format(on), now()],
        )?;
    } else {
        conn.execute(
            "DELETE FROM task_completions WHERE task_id = ?1 AND completed_on = ?2",
            params![task_id, format(on)],
        )?;
    }

    Ok(())
}

pub fn dates_for_task(
    conn: &Connection,
    task_id: i64,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<HashSet<NaiveDate>> {
    let mut stmt = conn.prepare(
        "SELECT completed_on FROM task_completions
         WHERE task_id = ?1 AND completed_on BETWEEN ?2 AND ?3",
    )?;

    let dates = stmt
        .query_map(params![task_id, format(from), format(to)], |row| {
            row.get::<_, String>(0)
        })?
        .collect::<rusqlite::Result<Vec<String>>>()?
        .into_iter()
        .filter_map(|text| NaiveDate::parse_from_str(&text, DATE_FORMAT).ok())
        .collect();

    Ok(dates)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn seed_habit(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO tasks (title, recurrence, created_at, updated_at)
             VALUES ('Stretch', 'daily', datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn logging_the_same_day_twice_keeps_one_row() {
        let conn = db::open_in_memory().unwrap();
        let task_id = seed_habit(&conn);
        let day = NaiveDate::from_ymd_opt(2026, 7, 30).unwrap();

        set(&conn, task_id, day, true).unwrap();
        set(&conn, task_id, day, true).unwrap();

        assert_eq!(dates_for_task(&conn, task_id, day, day).unwrap().len(), 1);
    }

    #[test]
    fn unlogging_a_day_that_was_never_logged_is_harmless() {
        let conn = db::open_in_memory().unwrap();
        let task_id = seed_habit(&conn);
        let day = NaiveDate::from_ymd_opt(2026, 7, 30).unwrap();

        set(&conn, task_id, day, false).unwrap();

        assert!(dates_for_task(&conn, task_id, day, day).unwrap().is_empty());
    }

    #[test]
    fn the_range_is_inclusive_at_both_ends() {
        let conn = db::open_in_memory().unwrap();
        let task_id = seed_habit(&conn);
        for day in 28..=31 {
            set(&conn, task_id, NaiveDate::from_ymd_opt(2026, 7, day).unwrap(), true).unwrap();
        }

        let found = dates_for_task(
            &conn,
            task_id,
            NaiveDate::from_ymd_opt(2026, 7, 29).unwrap(),
            NaiveDate::from_ymd_opt(2026, 7, 30).unwrap(),
        )
        .unwrap();

        assert_eq!(found.len(), 2);
        assert!(found.contains(&NaiveDate::from_ymd_opt(2026, 7, 29).unwrap()));
    }
}
