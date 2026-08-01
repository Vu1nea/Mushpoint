//! Assembles a streak card: task + grace setting + completion log, run through
//! the pure math in `crate::streak`.

use chrono::{Datelike, Duration, NaiveDate};
use rusqlite::Connection;

use super::{completion, local_date_of, task, today};
use crate::error::{Error, Result};
use crate::models::{CellState, DayCell, StreakCard, Task};
use crate::streak;

/// How many trailing days the Task Manager's heatmap strip shows.
pub const DEFAULT_CELL_DAYS: i64 = 20;

/// One card per habit, in the same order `task::list` uses.
pub fn list(conn: &Connection, days: i64) -> Result<Vec<StreakCard>> {
    task::list_recurring(conn)?
        .into_iter()
        .map(|habit| build(conn, habit, days))
        .collect()
}

/// `on = None` means today. Returns the recomputed card so the caller never has
/// to make a second round trip to see the new streak.
pub fn set_completion(
    conn: &Connection,
    task_id: i64,
    on: Option<NaiveDate>,
    done: bool,
    days: i64,
) -> Result<StreakCard> {
    let habit = task::get(conn, task_id)?;
    ensure_recurring(&habit)?;

    completion::set(conn, task_id, on.unwrap_or_else(today), done)?;
    build(conn, habit, days)
}

fn ensure_recurring(habit: &Task) -> Result<()> {
    if habit.is_recurring() {
        Ok(())
    } else {
        Err(Error::Validation(format!(
            "task {} is not recurring, so it has no streak",
            habit.id
        )))
    }
}

/// Assembling a card without a cadence is a contradiction, not just missing
/// data — the caller already gets a `validation` error from `ensure_recurring`
/// before this ever reaches the "no recurrence" branch below.
fn build(conn: &Connection, habit: Task, days: i64) -> Result<StreakCard> {
    ensure_recurring(&habit)?;
    let recurrence = habit
        .recurrence
        .expect("ensure_recurring already rejected a task with no recurrence");

    let today = today();
    // History starts the day the habit was created: days before it existed are
    // not misses. A weekly habit's anchor is that same day's weekday.
    let start = local_date_of(&habit.created_at)?.min(today);
    let anchor = start.weekday();
    let grace = super::settings::grace_days(conn)?;

    let done = completion::dates_for_task(conn, habit.id, start, today)?;
    let expected = streak::expected_days(recurrence, anchor, start, today);
    let summary = streak::summarize(&expected, &done, grace, today);

    let expected_set: std::collections::HashSet<NaiveDate> = expected.into_iter().collect();
    let first_cell = today - Duration::days(days - 1);
    let cells = (0..days)
        .map(|offset| {
            let day = first_cell + Duration::days(offset);
            let state = if expected_set.contains(&day) {
                streak::state_of(day, &done, grace, today)
            } else {
                CellState::NotExpected
            };
            DayCell {
                date: completion::format(day),
                state,
            }
        })
        .collect();

    Ok(StreakCard {
        current: summary.current,
        longest: summary.longest,
        done_today: done.contains(&today),
        cells,
        task: habit,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::models::{GoalInput, Recurrence, TaskInput, Timeframe};
    use crate::repo::{completion, goal, task};

    fn habit(conn: &Connection, title: &str, recurrence: Recurrence) -> i64 {
        task::create(
            conn,
            TaskInput {
                title: title.into(),
                due_date: None,
                goal_id: None,
                subgoal_id: None,
                recurrence: Some(recurrence),
            },
        )
        .unwrap()
        .id
    }

    #[test]
    fn a_fresh_habit_has_an_empty_streak() {
        let conn = db::open_in_memory().unwrap();
        habit(&conn, "Stretch", Recurrence::Daily);

        let card = list(&conn, 20).unwrap().into_iter().next().unwrap();

        assert_eq!((card.current, card.longest), (0, 0));
        assert!(!card.done_today);
        assert_eq!(card.cells.len(), 20);
    }

    #[test]
    fn checking_off_today_starts_a_streak() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);

        let card = set_completion(&conn, id, None, true, 20).unwrap();

        assert_eq!(card.current, 1);
        assert!(card.done_today);
        assert_eq!(card.cells.last().unwrap().state, CellState::Done);
    }

    #[test]
    fn unchecking_removes_the_completion() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);
        set_completion(&conn, id, None, true, 20).unwrap();

        let card = set_completion(&conn, id, None, false, 20).unwrap();

        assert_eq!(card.current, 0);
        assert!(!card.done_today);
    }

    #[test]
    fn checking_off_twice_is_idempotent() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);

        set_completion(&conn, id, None, true, 20).unwrap();
        let card = set_completion(&conn, id, None, true, 20).unwrap();

        assert_eq!(card.current, 1);
        let logged: i64 = conn
            .query_row("SELECT COUNT(*) FROM task_completions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(logged, 1);
    }

    #[test]
    fn days_before_the_task_existed_are_not_misses() {
        let conn = db::open_in_memory().unwrap();
        habit(&conn, "Stretch", Recurrence::Daily);

        let card = list(&conn, 20).unwrap().into_iter().next().unwrap();

        // The task was created today, so every earlier cell is outside its history.
        let not_expected = card
            .cells
            .iter()
            .filter(|cell| cell.state == CellState::NotExpected)
            .count();
        assert_eq!(not_expected, 19);
    }

    #[test]
    fn only_recurring_tasks_have_streaks() {
        let conn = db::open_in_memory().unwrap();
        let one_off = task::create(
            &conn,
            TaskInput {
                title: "Buy a notebook".into(),
                due_date: None,
                goal_id: None,
                subgoal_id: None,
                recurrence: None,
            },
        )
        .unwrap()
        .id;

        assert_eq!(
            set_completion(&conn, one_off, None, true, 20).unwrap_err().kind(),
            "validation"
        );
        assert_eq!(list(&conn, 20).unwrap().len(), 0);
    }

    #[test]
    fn listing_covers_every_habit() {
        let conn = db::open_in_memory().unwrap();
        habit(&conn, "Stretch", Recurrence::Daily);
        habit(&conn, "Review the week", Recurrence::Weekly);

        let titles: Vec<String> = list(&conn, 20)
            .unwrap()
            .into_iter()
            .map(|card| card.task.title)
            .collect();

        assert_eq!(titles.len(), 2);
        assert!(titles.contains(&"Stretch".to_string()));
    }

    #[test]
    fn the_grace_setting_changes_the_answer() {
        let conn = db::open_in_memory().unwrap();
        let id = habit(&conn, "Stretch", Recurrence::Daily);
        let today = crate::repo::today();
        // Backdate the habit so it has three days of history, and log only the oldest.
        conn.execute(
            "UPDATE tasks SET created_at = ?1 WHERE id = ?2",
            rusqlite::params![
                (today - chrono::Duration::days(2))
                    .and_hms_opt(9, 0, 0)
                    .unwrap()
                    .and_utc()
                    .to_rfc3339(),
                id
            ],
        )
        .unwrap();
        completion::set(&conn, id, today - chrono::Duration::days(2), true).unwrap();

        conn.execute("UPDATE settings SET streak_grace_days = 0 WHERE id = 1", [])
            .unwrap();
        let card = list(&conn, 20).unwrap().into_iter().next().unwrap();
        assert_eq!(card.current, 0, "grace 0 breaks on the gap");

        conn.execute("UPDATE settings SET streak_grace_days = 7 WHERE id = 1", [])
            .unwrap();
        let card = list(&conn, 20).unwrap().into_iter().next().unwrap();
        assert_eq!(card.current, 1, "grace 7 keeps it alive");
    }

    #[test]
    fn habits_are_left_out_of_goal_progress() {
        let conn = db::open_in_memory().unwrap();
        let goal_id = goal::create(
            &conn,
            GoalInput {
                category_id: None,
                title: "Get fit".into(),
                description: None,
                timeframe: Timeframe::Mid,
                due_date: None,
                motivation_text: None,
                motivation_image_path: None,
            },
        )
        .unwrap()
        .id;

        // One ordinary task, done, plus a habit that should not dilute the average.
        let ordinary = task::create(
            &conn,
            TaskInput {
                title: "Buy shoes".into(),
                due_date: None,
                goal_id: Some(goal_id),
                subgoal_id: None,
                recurrence: None,
            },
        )
        .unwrap()
        .id;
        task::set_status(&conn, ordinary, crate::models::TaskStatus::Done).unwrap();
        task::create(
            &conn,
            TaskInput {
                title: "Stretch".into(),
                due_date: None,
                goal_id: Some(goal_id),
                subgoal_id: None,
                recurrence: Some(Recurrence::Daily),
            },
        )
        .unwrap();

        assert_eq!(goal::get_detail(&conn, goal_id).unwrap().progress, 1.0);
    }
}
