use rusqlite::{params, Connection, Row};

use super::{now, optional_text, required_text, task};
use crate::error::{Error, Result};
use crate::models::{Subgoal, SubgoalDetail, SubgoalInput, SubgoalUpdate};
use crate::progress;

const COLUMNS: &str = "id, goal_id, title, due_date, is_complete, position, created_at, updated_at";
const ORDER: &str = "ORDER BY position, id";

fn map(row: &Row) -> rusqlite::Result<Subgoal> {
    Ok(Subgoal {
        id: row.get("id")?,
        goal_id: row.get("goal_id")?,
        title: row.get("title")?,
        due_date: row.get("due_date")?,
        is_complete: row.get("is_complete")?,
        position: row.get("position")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

/// Every subgoal in the database, grouped by goal. The Task Manager needs this
/// to offer subgoals as task parents without loading one goal at a time.
pub fn list_all(conn: &Connection) -> Result<Vec<Subgoal>> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM subgoals ORDER BY goal_id, position, id"))?;
    let subgoals = stmt.query_map([], map)?.collect::<rusqlite::Result<_>>()?;
    Ok(subgoals)
}

pub fn list_for_goal(conn: &Connection, goal_id: i64) -> Result<Vec<Subgoal>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM subgoals WHERE goal_id = ?1 {ORDER}"
    ))?;
    let subgoals = stmt
        .query_map(params![goal_id], map)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(subgoals)
}

/// Each subgoal with its tasks and its own progress attached.
pub fn detail_for_goal(conn: &Connection, goal_id: i64) -> Result<Vec<SubgoalDetail>> {
    list_for_goal(conn, goal_id)?
        .into_iter()
        .map(|subgoal| {
            let tasks = task::list_for_subgoal(conn, subgoal.id)?;
            let completions: Vec<f64> = tasks.iter().map(|t| t.status.completion()).collect();
            Ok(SubgoalDetail {
                progress: progress::subgoal_progress(subgoal.is_complete, &completions),
                subgoal,
                tasks,
            })
        })
        .collect()
}

/// Just the progress numbers, for computing a parent goal's average.
pub fn progresses_for_goal(conn: &Connection, goal_id: i64) -> Result<Vec<f64>> {
    Ok(detail_for_goal(conn, goal_id)?
        .into_iter()
        .map(|detail| detail.progress)
        .collect())
}

pub fn get(conn: &Connection, id: i64) -> Result<Subgoal> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM subgoals WHERE id = ?1"),
        params![id],
        map,
    )
    .map_err(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => Error::not_found("subgoal", id),
        other => other.into(),
    })
}

pub fn create(conn: &Connection, input: SubgoalInput) -> Result<Subgoal> {
    let title = required_text("subgoal title", &input.title)?;
    super::goal::ensure_exists(conn, input.goal_id)?;

    let next_position: i64 = conn.query_row(
        "SELECT COALESCE(MAX(position) + 1, 0) FROM subgoals WHERE goal_id = ?1",
        params![input.goal_id],
        |row| row.get(0),
    )?;
    let timestamp = now();

    conn.execute(
        "INSERT INTO subgoals (goal_id, title, due_date, is_complete, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?5, ?5)",
        params![
            input.goal_id,
            title,
            optional_text(input.due_date),
            next_position,
            timestamp
        ],
    )?;

    get(conn, conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, input: SubgoalUpdate) -> Result<Subgoal> {
    let title = required_text("subgoal title", &input.title)?;
    let changed = conn.execute(
        "UPDATE subgoals SET title = ?1, due_date = ?2, is_complete = ?3, updated_at = ?4
         WHERE id = ?5",
        params![
            title,
            optional_text(input.due_date),
            input.is_complete,
            now(),
            id
        ],
    )?;

    if changed == 0 {
        return Err(Error::not_found("subgoal", id));
    }
    get(conn, id)
}

pub fn set_complete(conn: &Connection, id: i64, is_complete: bool) -> Result<Subgoal> {
    let changed = conn.execute(
        "UPDATE subgoals SET is_complete = ?1, updated_at = ?2 WHERE id = ?3",
        params![is_complete, now(), id],
    )?;

    if changed == 0 {
        return Err(Error::not_found("subgoal", id));
    }
    get(conn, id)
}

/// Deleting a subgoal keeps its tasks; they fall back to being direct tasks of
/// the goal (ON DELETE SET NULL on `subgoal_id`).
pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM subgoals WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(Error::not_found("subgoal", id));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{GoalInput, TaskInput, TaskStatus, Timeframe};
    use crate::repo::goal;

    fn seed_goal(conn: &Connection) -> i64 {
        goal::create(
            conn,
            GoalInput {
                category_id: None,
                title: "Ship v1".into(),
                description: None,
                timeframe: Timeframe::Mid,
                due_date: None,
                motivation_text: None,
                motivation_image_path: None,
            },
        )
        .unwrap()
        .id
    }

    fn add(conn: &Connection, goal_id: i64, title: &str) -> Subgoal {
        create(
            conn,
            SubgoalInput {
                goal_id,
                title: title.into(),
                due_date: None,
            },
        )
        .unwrap()
    }

    #[test]
    fn new_subgoals_append_in_order() {
        let conn = db::open_in_memory().unwrap();
        let goal_id = seed_goal(&conn);

        let first = add(&conn, goal_id, "Write the schema");
        let second = add(&conn, goal_id, "Wire the UI");

        assert_eq!((first.position, second.position), (0, 1));
        assert_eq!(list_for_goal(&conn, goal_id).unwrap().len(), 2);
    }

    #[test]
    fn list_all_spans_every_goal_in_position_order() {
        let conn = db::open_in_memory().unwrap();
        let first_goal = seed_goal(&conn);
        let second_goal = seed_goal(&conn);

        add(&conn, first_goal, "Write the schema");
        add(&conn, second_goal, "Book the flight");
        add(&conn, first_goal, "Wire the UI");

        let titles: Vec<String> = list_all(&conn)
            .unwrap()
            .into_iter()
            .map(|subgoal| subgoal.title)
            .collect();

        assert_eq!(titles, ["Write the schema", "Wire the UI", "Book the flight"]);
    }

    #[test]
    fn rejects_a_missing_goal() {
        let conn = db::open_in_memory().unwrap();
        let err = create(
            &conn,
            SubgoalInput {
                goal_id: 404,
                title: "Orphan".into(),
                due_date: None,
            },
        )
        .unwrap_err();

        assert_eq!(err.kind(), "not_found");
    }

    #[test]
    fn taskless_subgoal_progress_follows_its_checkbox() {
        let conn = db::open_in_memory().unwrap();
        let goal_id = seed_goal(&conn);
        let subgoal = add(&conn, goal_id, "Write the schema");

        assert_eq!(progresses_for_goal(&conn, goal_id).unwrap(), vec![0.0]);

        set_complete(&conn, subgoal.id, true).unwrap();
        assert_eq!(progresses_for_goal(&conn, goal_id).unwrap(), vec![1.0]);
    }

    #[test]
    fn subgoal_with_tasks_averages_them() {
        let conn = db::open_in_memory().unwrap();
        let goal_id = seed_goal(&conn);
        let subgoal = add(&conn, goal_id, "Write the schema");

        for title in ["Draft the tables", "Add indexes"] {
            task::create(
                &conn,
                TaskInput {
                    title: title.into(),
                    due_date: None,
                    goal_id: None,
                    subgoal_id: Some(subgoal.id),
                    is_recurring: false,
                },
            )
            .unwrap();
        }
        let first = task::list_for_subgoal(&conn, subgoal.id).unwrap()[0].id;
        task::set_status(&conn, first, TaskStatus::Done).unwrap();

        assert_eq!(progresses_for_goal(&conn, goal_id).unwrap(), vec![0.5]);
    }

    #[test]
    fn deleting_a_subgoal_leaves_its_tasks_on_the_goal() {
        let conn = db::open_in_memory().unwrap();
        let goal_id = seed_goal(&conn);
        let subgoal = add(&conn, goal_id, "Write the schema");
        task::create(
            &conn,
            TaskInput {
                title: "Draft the tables".into(),
                due_date: None,
                goal_id: None,
                subgoal_id: Some(subgoal.id),
                is_recurring: false,
            },
        )
        .unwrap();

        delete(&conn, subgoal.id).unwrap();

        let direct = task::list_direct_for_goal(&conn, goal_id).unwrap();
        assert_eq!(direct.len(), 1);
    }
}
