use rusqlite::Connection;

use crate::error::Result;

/// Schema versions, applied in order. Each entry is one migration; append, never
/// edit a shipped one — `PRAGMA user_version` records how many have run.
const MIGRATIONS: &[&str] = &[M0001_INITIAL, M0002_STREAKS];

const M0001_INITIAL: &str = r#"
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE,
    color_token TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL
);

CREATE TABLE goals (
    id                    INTEGER PRIMARY KEY,
    category_id           INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title                 TEXT    NOT NULL,
    description           TEXT,
    timeframe             TEXT    NOT NULL CHECK (timeframe IN ('short', 'mid', 'long')),
    status                TEXT    NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'completed', 'archived')),
    due_date              TEXT,
    motivation_text       TEXT,
    motivation_image_path TEXT,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL
);

CREATE INDEX idx_goals_category ON goals(category_id);
CREATE INDEX idx_goals_status ON goals(status);

CREATE TABLE subgoals (
    id          INTEGER PRIMARY KEY,
    goal_id     INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    due_date    TEXT,
    is_complete INTEGER NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE INDEX idx_subgoals_goal ON subgoals(goal_id);

CREATE TABLE tasks (
    id           INTEGER PRIMARY KEY,
    title        TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'todo'
                         CHECK (status IN ('todo', 'in_progress', 'done')),
    due_date     TEXT,
    goal_id      INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    subgoal_id   INTEGER REFERENCES subgoals(id) ON DELETE SET NULL,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_tasks_goal ON tasks(goal_id);
CREATE INDEX idx_tasks_subgoal ON tasks(subgoal_id);

-- Single-row table: this app has exactly one local user, so there is nothing to key on.
CREATE TABLE settings (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    active_theme TEXT    NOT NULL DEFAULT 'nocturne',
    updated_at   TEXT    NOT NULL
);

INSERT INTO settings (id, active_theme, updated_at)
VALUES (1, 'nocturne', datetime('now'));

INSERT INTO categories (name, color_token, is_default, created_at) VALUES
    ('Work',          'accent-primary',   1, datetime('now')),
    ('Gym',           'accent-secondary', 1, datetime('now')),
    ('School',        'accent-tertiary',  1, datetime('now')),
    ('Side Projects', 'accent-primary',   1, datetime('now')),
    ('Social',        'accent-secondary', 1, datetime('now'));
"#;

const M0002_STREAKS: &str = r#"
-- One cadence column replaces the boolean: "recurring" now means "has a recurrence",
-- so `is_recurring = 1, recurrence IS NULL` cannot be represented at all.
ALTER TABLE tasks ADD COLUMN recurrence TEXT
    CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekdays', 'weekly'));

UPDATE tasks SET recurrence = 'daily' WHERE is_recurring = 1;

ALTER TABLE tasks DROP COLUMN is_recurring;

-- `completed_on` is a LOCAL calendar date, never a UTC instant: a habit checked
-- off at 11pm belongs to that evening, not to tomorrow in UTC.
CREATE TABLE task_completions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT    NOT NULL,
    created_at   TEXT    NOT NULL,
    UNIQUE (task_id, completed_on)
);

CREATE INDEX idx_completions_task ON task_completions(task_id, completed_on);

ALTER TABLE settings ADD COLUMN streak_grace_days INTEGER NOT NULL DEFAULT 2
    CHECK (streak_grace_days BETWEEN 0 AND 7);
"#;

/// Applies every migration the database has not seen yet. Safe to call on each start.
pub fn run(conn: &mut Connection) -> Result<()> {
    let applied: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;

    for (index, sql) in MIGRATIONS.iter().enumerate().skip(applied as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", (index + 1) as i64)?;
        tx.commit()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn migrations_bring_a_fresh_database_up_to_date() {
        let conn = db::open_in_memory().unwrap();
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();

        assert_eq!(version, MIGRATIONS.len() as i64);
    }

    #[test]
    fn running_migrations_twice_is_a_no_op() {
        let mut conn = db::open_in_memory().unwrap();
        run(&mut conn).unwrap();

        let categories: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |row| row.get(0))
            .unwrap();

        assert_eq!(categories, 5, "default categories must not be seeded twice");
    }

    #[test]
    fn default_categories_and_settings_are_seeded() {
        let conn = db::open_in_memory().unwrap();

        let theme: String = conn
            .query_row(
                "SELECT active_theme FROM settings WHERE id = 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let names: Vec<String> = conn
            .prepare("SELECT name FROM categories ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();

        assert_eq!(theme, "nocturne");
        assert_eq!(names, ["Work", "Gym", "School", "Side Projects", "Social"]);
    }

    #[test]
    fn deleting_a_goal_cascades_to_its_subgoals() {
        let conn = db::open_in_memory().unwrap();
        conn.execute(
            "INSERT INTO goals (id, title, timeframe, created_at, updated_at)
             VALUES (1, 'Ship v1', 'mid', datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO subgoals (goal_id, title, created_at, updated_at)
             VALUES (1, 'Write the schema', datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();

        conn.execute("DELETE FROM goals WHERE id = 1", []).unwrap();
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM subgoals", [], |row| row.get(0))
            .unwrap();

        assert_eq!(remaining, 0);
    }

    #[test]
    fn migration_two_backfills_recurring_tasks_to_daily() {
        // Start at schema version 1 so the upgrade path itself is exercised,
        // not just the end state a fresh database lands on.
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(MIGRATIONS[0]).unwrap();
        conn.pragma_update(None, "user_version", 1i64).unwrap();
        conn.execute(
            "INSERT INTO tasks (title, is_recurring, created_at, updated_at)
             VALUES ('Stretch', 1, datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO tasks (title, is_recurring, created_at, updated_at)
             VALUES ('Buy a notebook', 0, datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();

        run(&mut conn).unwrap();

        let mut stmt = conn
            .prepare("SELECT title, recurrence FROM tasks ORDER BY id")
            .unwrap();
        let rows: Vec<(String, Option<String>)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();

        assert_eq!(
            rows,
            vec![
                ("Stretch".to_string(), Some("daily".to_string())),
                ("Buy a notebook".to_string(), None),
            ]
        );
    }

    #[test]
    fn migration_two_drops_the_old_recurring_flag() {
        let conn = db::open_in_memory().unwrap();
        let err = conn
            .query_row("SELECT is_recurring FROM tasks", [], |row| row.get::<_, i64>(0))
            .unwrap_err();

        assert!(
            err.to_string().contains("is_recurring"),
            "expected the dropped column to be unknown, got: {err}"
        );
    }

    #[test]
    fn completions_are_unique_per_task_and_day_and_cascade() {
        let conn = db::open_in_memory().unwrap();
        conn.execute(
            "INSERT INTO tasks (id, title, recurrence, created_at, updated_at)
             VALUES (1, 'Stretch', 'daily', datetime('now'), datetime('now'))",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO task_completions (task_id, completed_on, created_at)
             VALUES (1, '2026-07-30', datetime('now'))",
            [],
        )
        .unwrap();

        let duplicate = conn.execute(
            "INSERT INTO task_completions (task_id, completed_on, created_at)
             VALUES (1, '2026-07-30', datetime('now'))",
            [],
        );
        assert!(duplicate.is_err(), "the same day must not be logged twice");

        conn.execute("DELETE FROM tasks WHERE id = 1", []).unwrap();
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM task_completions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(remaining, 0, "completions must cascade with their task");
    }

    #[test]
    fn the_grace_period_defaults_to_two_days() {
        let conn = db::open_in_memory().unwrap();
        let grace: i64 = conn
            .query_row("SELECT streak_grace_days FROM settings WHERE id = 1", [], |row| {
                row.get(0)
            })
            .unwrap();

        assert_eq!(grace, 2);
    }
}
