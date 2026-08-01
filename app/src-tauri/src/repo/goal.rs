use rusqlite::{params, Connection, Row};

use super::{category, now, optional_text, required_text, subgoal, task};
use crate::error::{Error, Result};
use crate::models::{Goal, GoalDetail, GoalInput, GoalStatus, GoalSummary};
use crate::progress;

const COLUMNS: &str = "id, category_id, title, description, timeframe, status, due_date,
     motivation_text, motivation_image_path, created_at, updated_at";
const ORDER: &str = "ORDER BY (due_date IS NULL), due_date, created_at DESC, id DESC";

fn map(row: &Row) -> rusqlite::Result<Goal> {
    Ok(Goal {
        id: row.get("id")?,
        category_id: row.get("category_id")?,
        title: row.get("title")?,
        description: row.get("description")?,
        timeframe: row.get("timeframe")?,
        status: row.get("status")?,
        due_date: row.get("due_date")?,
        motivation_text: row.get("motivation_text")?,
        motivation_image_path: row.get("motivation_image_path")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

/// Lists goals, optionally narrowed to one status — the Goals page shows active
/// ones by default and completed/archived behind a filter.
pub fn list(conn: &Connection, status: Option<GoalStatus>) -> Result<Vec<GoalSummary>> {
    let filter = if status.is_some() {
        "WHERE status = ?1"
    } else {
        ""
    };
    let mut stmt = conn.prepare(&format!("SELECT {COLUMNS} FROM goals {filter} {ORDER}"))?;

    let goals: Vec<Goal> = match status {
        Some(status) => stmt
            .query_map(params![status], map)?
            .collect::<rusqlite::Result<_>>()?,
        None => stmt.query_map([], map)?.collect::<rusqlite::Result<_>>()?,
    };

    goals
        .into_iter()
        .map(|goal| {
            let subgoal_progresses = subgoal::progresses_for_goal(conn, goal.id)?;
            let direct_tasks = task::list_direct_for_goal(conn, goal.id)?;
            let completions: Vec<f64> = direct_tasks
                .iter()
                .filter(|task| task.counts_toward_progress())
                .map(|t| t.status.completion())
                .collect();

            Ok(GoalSummary {
                progress: progress::goal_progress(&subgoal_progresses, &completions),
                subgoal_count: subgoal_progresses.len(),
                task_count: direct_tasks.len(),
                goal,
            })
        })
        .collect()
}

/// The goal plus its subgoals, tasks and derived progress, in one round trip.
pub fn get_detail(conn: &Connection, id: i64) -> Result<GoalDetail> {
    let goal = get(conn, id)?;
    let subgoals = subgoal::detail_for_goal(conn, id)?;
    let direct_tasks = task::list_direct_for_goal(conn, id)?;

    let subgoal_progresses: Vec<f64> = subgoals.iter().map(|s| s.progress).collect();
    let completions: Vec<f64> = direct_tasks
        .iter()
        .filter(|task| task.counts_toward_progress())
        .map(|t| t.status.completion())
        .collect();
    let category = match goal.category_id {
        Some(category_id) => Some(category::get(conn, category_id)?),
        None => None,
    };

    Ok(GoalDetail {
        progress: progress::goal_progress(&subgoal_progresses, &completions),
        goal,
        category,
        subgoals,
        direct_tasks,
    })
}

pub fn get(conn: &Connection, id: i64) -> Result<Goal> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM goals WHERE id = ?1"),
        params![id],
        map,
    )
    .map_err(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => Error::not_found("goal", id),
        other => other.into(),
    })
}

pub fn ensure_exists(conn: &Connection, id: i64) -> Result<()> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM goals WHERE id = ?1)",
        params![id],
        |row| row.get(0),
    )?;

    if exists {
        Ok(())
    } else {
        Err(Error::not_found("goal", id))
    }
}

pub fn create(conn: &Connection, input: GoalInput) -> Result<Goal> {
    let title = required_text("goal title", &input.title)?;
    if let Some(category_id) = input.category_id {
        category::get(conn, category_id)?;
    }
    let timestamp = now();

    conn.execute(
        "INSERT INTO goals (category_id, title, description, timeframe, status, due_date,
                            motivation_text, motivation_image_path, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'active', ?5, ?6, ?7, ?8, ?8)",
        params![
            input.category_id,
            title,
            optional_text(input.description),
            input.timeframe,
            optional_text(input.due_date),
            optional_text(input.motivation_text),
            optional_text(input.motivation_image_path),
            timestamp
        ],
    )?;

    get(conn, conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, input: GoalInput) -> Result<Goal> {
    let title = required_text("goal title", &input.title)?;
    if let Some(category_id) = input.category_id {
        category::get(conn, category_id)?;
    }

    let changed = conn.execute(
        "UPDATE goals
         SET category_id = ?1, title = ?2, description = ?3, timeframe = ?4, due_date = ?5,
             motivation_text = ?6, motivation_image_path = ?7, updated_at = ?8
         WHERE id = ?9",
        params![
            input.category_id,
            title,
            optional_text(input.description),
            input.timeframe,
            optional_text(input.due_date),
            optional_text(input.motivation_text),
            optional_text(input.motivation_image_path),
            now(),
            id
        ],
    )?;

    if changed == 0 {
        return Err(Error::not_found("goal", id));
    }
    get(conn, id)
}

/// Completing or archiving is always an explicit user action — progress hitting
/// 100% never flips this by itself.
pub fn set_status(conn: &Connection, id: i64, status: GoalStatus) -> Result<Goal> {
    let changed = conn.execute(
        "UPDATE goals SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, now(), id],
    )?;

    if changed == 0 {
        return Err(Error::not_found("goal", id));
    }
    get(conn, id)
}

/// Subgoals cascade-delete with the goal; their tasks only lose their link
/// (ON DELETE SET NULL) and would otherwise survive as standalone tasks. The
/// caller decides whether that's what the user wants.
pub fn delete(conn: &Connection, id: i64, delete_orphaned_tasks: bool) -> Result<()> {
    if delete_orphaned_tasks {
        conn.execute(
            "DELETE FROM tasks WHERE subgoal_id IN (SELECT id FROM subgoals WHERE goal_id = ?1)",
            params![id],
        )?;
    }

    let changed = conn.execute("DELETE FROM goals WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(Error::not_found("goal", id));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{SubgoalInput, TaskInput, TaskStatus, Timeframe};

    fn input(title: &str) -> GoalInput {
        GoalInput {
            category_id: None,
            title: title.into(),
            description: None,
            timeframe: Timeframe::Mid,
            due_date: None,
            motivation_text: None,
            motivation_image_path: None,
        }
    }

    fn add_subgoal(conn: &Connection, goal_id: i64, title: &str) -> i64 {
        subgoal::create(
            conn,
            SubgoalInput {
                goal_id,
                title: title.into(),
                due_date: None,
            },
        )
        .unwrap()
        .id
    }

    fn add_task(conn: &Connection, goal_id: Option<i64>, subgoal_id: Option<i64>) -> i64 {
        task::create(
            conn,
            TaskInput {
                title: "A task".into(),
                due_date: None,
                goal_id,
                subgoal_id,
                recurrence: None,
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn creates_a_goal_as_active() {
        let conn = db::open_in_memory().unwrap();
        let goal = create(&conn, input("Ship v1")).unwrap();

        assert_eq!(goal.status, GoalStatus::Active);
        assert_eq!(goal.timeframe, Timeframe::Mid);
    }

    #[test]
    fn rejects_a_blank_title_or_missing_category() {
        let conn = db::open_in_memory().unwrap();

        assert_eq!(create(&conn, input("  ")).unwrap_err().kind(), "validation");
        assert_eq!(
            create(
                &conn,
                GoalInput {
                    category_id: Some(404),
                    ..input("Ship v1")
                }
            )
            .unwrap_err()
            .kind(),
            "not_found"
        );
    }

    #[test]
    fn a_goal_with_no_children_sits_at_zero() {
        let conn = db::open_in_memory().unwrap();
        create(&conn, input("Ship v1")).unwrap();

        let summary = &list(&conn, None).unwrap()[0];
        assert_eq!(summary.progress, 0.0);
    }

    #[test]
    fn progress_averages_subgoals_and_direct_tasks_equally() {
        let conn = db::open_in_memory().unwrap();
        let goal = create(&conn, input("Ship v1")).unwrap();

        // Subgoal at 50% (one of two tasks done).
        let subgoal_id = add_subgoal(&conn, goal.id, "Write the schema");
        let done = add_task(&conn, None, Some(subgoal_id));
        add_task(&conn, None, Some(subgoal_id));
        task::set_status(&conn, done, TaskStatus::Done).unwrap();

        // One direct task, finished.
        let direct = add_task(&conn, Some(goal.id), None);
        task::set_status(&conn, direct, TaskStatus::Done).unwrap();

        let detail = get_detail(&conn, goal.id).unwrap();
        assert_eq!(detail.progress, 0.75);
        assert_eq!(detail.subgoals[0].progress, 0.5);
        assert_eq!(detail.direct_tasks.len(), 1);
    }

    #[test]
    fn in_progress_tasks_do_not_count_as_partial() {
        let conn = db::open_in_memory().unwrap();
        let goal = create(&conn, input("Ship v1")).unwrap();
        let task_id = add_task(&conn, Some(goal.id), None);

        task::set_status(&conn, task_id, TaskStatus::InProgress).unwrap();

        assert_eq!(get_detail(&conn, goal.id).unwrap().progress, 0.0);
    }

    #[test]
    fn status_is_independent_of_progress() {
        let conn = db::open_in_memory().unwrap();
        let goal = create(&conn, input("Ship v1")).unwrap();
        let task_id = add_task(&conn, Some(goal.id), None);
        task::set_status(&conn, task_id, TaskStatus::Done).unwrap();

        // Full progress, still active until the user says otherwise.
        assert_eq!(get_detail(&conn, goal.id).unwrap().progress, 1.0);
        assert_eq!(get(&conn, goal.id).unwrap().status, GoalStatus::Active);

        set_status(&conn, goal.id, GoalStatus::Completed).unwrap();
        assert_eq!(list(&conn, Some(GoalStatus::Active)).unwrap().len(), 0);
        assert_eq!(list(&conn, Some(GoalStatus::Completed)).unwrap().len(), 1);
    }

    #[test]
    fn detail_carries_the_linked_category() {
        let conn = db::open_in_memory().unwrap();
        let category_id = category::list(&conn).unwrap()[0].id;
        let goal = create(
            &conn,
            GoalInput {
                category_id: Some(category_id),
                ..input("Ship v1")
            },
        )
        .unwrap();

        let detail = get_detail(&conn, goal.id).unwrap();
        assert_eq!(detail.category.map(|c| c.id), Some(category_id));
    }

    #[test]
    fn deleting_a_goal_removes_its_subgoals_and_unlinks_its_tasks() {
        let conn = db::open_in_memory().unwrap();
        let goal = create(&conn, input("Ship v1")).unwrap();
        let subgoal_id = add_subgoal(&conn, goal.id, "Write the schema");
        let direct_task_id = add_task(&conn, Some(goal.id), None);
        let subgoal_task_id = add_task(&conn, None, Some(subgoal_id));

        delete(&conn, goal.id, false).unwrap();

        assert_eq!(get(&conn, goal.id).unwrap_err().kind(), "not_found");
        assert_eq!(task::get(&conn, direct_task_id).unwrap().goal_id, None);
        assert_eq!(task::get(&conn, subgoal_task_id).unwrap().subgoal_id, None);
    }

    #[test]
    fn deleting_a_goal_can_also_delete_its_subgoal_tasks() {
        let conn = db::open_in_memory().unwrap();
        let goal = create(&conn, input("Ship v1")).unwrap();
        let subgoal_id = add_subgoal(&conn, goal.id, "Write the schema");
        let direct_task_id = add_task(&conn, Some(goal.id), None);
        let subgoal_task_id = add_task(&conn, None, Some(subgoal_id));

        delete(&conn, goal.id, true).unwrap();

        // Direct tasks are unaffected by the flag — only ever the subgoal's.
        assert_eq!(task::get(&conn, direct_task_id).unwrap().goal_id, None);
        assert_eq!(task::get(&conn, subgoal_task_id).unwrap_err().kind(), "not_found");
    }
}
