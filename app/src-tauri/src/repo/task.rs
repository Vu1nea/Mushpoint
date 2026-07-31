use rusqlite::{params, Connection, Row};

use super::{now, optional_text, required_text};
use crate::error::{Error, Result};
use crate::models::{Recurrence, Task, TaskInput, TaskStatus, TaskUpdate};

const COLUMNS: &str =
    "id, title, status, due_date, goal_id, subgoal_id, recurrence, created_at, updated_at";

fn map(row: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get("id")?,
        title: row.get("title")?,
        status: row.get("status")?,
        due_date: row.get("due_date")?,
        goal_id: row.get("goal_id")?,
        subgoal_id: row.get("subgoal_id")?,
        recurrence: row.get("recurrence")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

const ORDER: &str = "ORDER BY (due_date IS NULL), due_date, id";

pub fn list(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM tasks {ORDER}"))?;
    let tasks = stmt.query_map([], map)?.collect::<rusqlite::Result<_>>()?;
    Ok(tasks)
}

pub fn list_for_subgoal(conn: &Connection, subgoal_id: i64) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM tasks WHERE subgoal_id = ?1 {ORDER}"
    ))?;
    let tasks = stmt
        .query_map(params![subgoal_id], map)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(tasks)
}

/// Tasks hanging straight off the goal — the ones that count as its own direct
/// children for progress. Tasks under a subgoal are counted by that subgoal.
pub fn list_direct_for_goal(conn: &Connection, goal_id: i64) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM tasks WHERE goal_id = ?1 AND subgoal_id IS NULL {ORDER}"
    ))?;
    let tasks = stmt
        .query_map(params![goal_id], map)?
        .collect::<rusqlite::Result<_>>()?;
    Ok(tasks)
}

pub fn get(conn: &Connection, id: i64) -> Result<Task> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM tasks WHERE id = ?1"),
        params![id],
        map,
    )
    .map_err(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => Error::not_found("task", id),
        other => other.into(),
    })
}

pub fn create(conn: &Connection, input: TaskInput) -> Result<Task> {
    let title = required_text("task title", &input.title)?;
    let (goal_id, subgoal_id) = resolve_parents(conn, input.goal_id, input.subgoal_id)?;
    let timestamp = now();

    conn.execute(
        "INSERT INTO tasks (title, status, due_date, goal_id, subgoal_id, recurrence, created_at, updated_at)
         VALUES (?1, 'todo', ?2, ?3, ?4, ?5, ?6, ?6)",
        params![
            title,
            optional_text(input.due_date),
            goal_id,
            subgoal_id,
            input.recurrence,
            timestamp
        ],
    )?;

    get(conn, conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, input: TaskUpdate) -> Result<Task> {
    let title = required_text("task title", &input.title)?;
    let (goal_id, subgoal_id) = resolve_parents(conn, input.goal_id, input.subgoal_id)?;

    let changed = conn.execute(
        "UPDATE tasks
         SET title = ?1, status = ?2, due_date = ?3, goal_id = ?4, subgoal_id = ?5,
             recurrence = ?6, updated_at = ?7
         WHERE id = ?8",
        params![
            title,
            input.status,
            optional_text(input.due_date),
            goal_id,
            subgoal_id,
            input.recurrence,
            now(),
            id
        ],
    )?;

    if changed == 0 {
        return Err(Error::not_found("task", id));
    }
    get(conn, id)
}

pub fn set_status(conn: &Connection, id: i64, status: TaskStatus) -> Result<Task> {
    let changed = conn.execute(
        "UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, now(), id],
    )?;

    if changed == 0 {
        return Err(Error::not_found("task", id));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(Error::not_found("task", id));
    }
    Ok(())
}

/// A task under a subgoal always belongs to that subgoal's goal, whatever the
/// caller passed — otherwise progress could count the task under the wrong parent.
fn resolve_parents(
    conn: &Connection,
    goal_id: Option<i64>,
    subgoal_id: Option<i64>,
) -> Result<(Option<i64>, Option<i64>)> {
    let Some(subgoal_id) = subgoal_id else {
        if let Some(goal_id) = goal_id {
            super::goal::ensure_exists(conn, goal_id)?;
        }
        return Ok((goal_id, None));
    };

    let owner: i64 = conn
        .query_row(
            "SELECT goal_id FROM subgoals WHERE id = ?1",
            params![subgoal_id],
            |row| row.get(0),
        )
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => Error::not_found("subgoal", subgoal_id),
            other => other.into(),
        })?;

    Ok((Some(owner), Some(subgoal_id)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{GoalInput, SubgoalInput, Timeframe};
    use crate::repo::{goal, subgoal};

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

    fn task_input(title: &str) -> TaskInput {
        TaskInput {
            title: title.into(),
            due_date: None,
            goal_id: None,
            subgoal_id: None,
            recurrence: None,
        }
    }

    #[test]
    fn creates_an_unlinked_task_as_todo() {
        let conn = db::open_in_memory().unwrap();
        let task = create(&conn, task_input("Buy a notebook")).unwrap();

        assert_eq!(task.status, TaskStatus::Todo);
        assert_eq!(task.goal_id, None);
    }

    #[test]
    fn a_cadence_makes_a_task_recurring() {
        let conn = db::open_in_memory().unwrap();

        let one_off = create(&conn, task_input("Buy a notebook")).unwrap();
        let habit = create(
            &conn,
            TaskInput {
                recurrence: Some(Recurrence::Weekdays),
                ..task_input("Stretch")
            },
        )
        .unwrap();

        assert!(!one_off.is_recurring());
        assert!(habit.is_recurring());
        assert_eq!(get(&conn, habit.id).unwrap().recurrence, Some(Recurrence::Weekdays));
    }

    #[test]
    fn a_subgoal_task_inherits_that_subgoals_goal() {
        let conn = db::open_in_memory().unwrap();
        let goal_id = seed_goal(&conn);
        let subgoal_id = subgoal::create(
            &conn,
            SubgoalInput {
                goal_id,
                title: "Write the schema".into(),
                due_date: None,
            },
        )
        .unwrap()
        .id;

        let task = create(
            &conn,
            TaskInput {
                // Deliberately wrong parent goal: the subgoal wins.
                goal_id: None,
                subgoal_id: Some(subgoal_id),
                ..task_input("Draft the tables")
            },
        )
        .unwrap();

        assert_eq!(task.goal_id, Some(goal_id));
        assert_eq!(task.subgoal_id, Some(subgoal_id));
    }

    #[test]
    fn direct_goal_tasks_exclude_subgoal_tasks() {
        let conn = db::open_in_memory().unwrap();
        let goal_id = seed_goal(&conn);
        let subgoal_id = subgoal::create(
            &conn,
            SubgoalInput {
                goal_id,
                title: "Write the schema".into(),
                due_date: None,
            },
        )
        .unwrap()
        .id;

        create(
            &conn,
            TaskInput {
                goal_id: Some(goal_id),
                ..task_input("Read the OKR book")
            },
        )
        .unwrap();
        create(
            &conn,
            TaskInput {
                subgoal_id: Some(subgoal_id),
                ..task_input("Draft the tables")
            },
        )
        .unwrap();

        let direct = list_direct_for_goal(&conn, goal_id).unwrap();
        assert_eq!(direct.len(), 1);
    }

    #[test]
    fn rejects_linking_to_a_missing_parent() {
        let conn = db::open_in_memory().unwrap();

        let missing_goal = create(
            &conn,
            TaskInput {
                goal_id: Some(404),
                ..task_input("Orphan")
            },
        )
        .unwrap_err();
        let missing_subgoal = create(
            &conn,
            TaskInput {
                subgoal_id: Some(404),
                ..task_input("Orphan")
            },
        )
        .unwrap_err();

        assert_eq!(missing_goal.kind(), "not_found");
        assert_eq!(missing_subgoal.kind(), "not_found");
    }

    #[test]
    fn status_changes_and_deletes() {
        let conn = db::open_in_memory().unwrap();
        let task = create(&conn, task_input("Buy a notebook")).unwrap();

        let done = set_status(&conn, task.id, TaskStatus::Done).unwrap();
        assert_eq!(done.status, TaskStatus::Done);

        delete(&conn, task.id).unwrap();
        assert_eq!(get(&conn, task.id).unwrap_err().kind(), "not_found");
    }
}
