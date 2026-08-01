//! The IPC surface. Each command is a thin wrapper: lock the connection, call a
//! repo function, hand the result back. Rules live in `repo` and `progress`.

use tauri::State;

use crate::db::Db;
use crate::error::Result;
use crate::models::*;
use crate::repo;

/// The IPC handler list, shared by the real app and the mock-runtime tests so
/// the two can never register different sets of commands.
#[macro_export]
macro_rules! command_handlers {
    () => {
        tauri::generate_handler![
            $crate::commands::list_categories,
            $crate::commands::create_category,
            $crate::commands::update_category,
            $crate::commands::delete_category,
            $crate::commands::list_goals,
            $crate::commands::get_goal,
            $crate::commands::create_goal,
            $crate::commands::update_goal,
            $crate::commands::set_goal_status,
            $crate::commands::delete_goal,
            $crate::commands::list_subgoals,
            $crate::commands::create_subgoal,
            $crate::commands::update_subgoal,
            $crate::commands::set_subgoal_complete,
            $crate::commands::delete_subgoal,
            $crate::commands::list_tasks,
            $crate::commands::create_task,
            $crate::commands::update_task,
            $crate::commands::set_task_status,
            $crate::commands::delete_task,
            $crate::commands::list_streaks,
            $crate::commands::set_task_completion,
            $crate::commands::set_streak_grace_days,
            $crate::commands::get_settings,
            $crate::commands::set_active_theme,
        ]
    };
}

#[tauri::command]
pub fn list_categories(db: State<Db>) -> Result<Vec<Category>> {
    db.with(|conn| repo::category::list(conn))
}

#[tauri::command]
pub fn create_category(db: State<Db>, input: CategoryInput) -> Result<Category> {
    db.with(|conn| repo::category::create(conn, input))
}

#[tauri::command]
pub fn update_category(db: State<Db>, id: i64, input: CategoryInput) -> Result<Category> {
    db.with(|conn| repo::category::update(conn, id, input))
}

#[tauri::command]
pub fn delete_category(db: State<Db>, id: i64) -> Result<()> {
    db.with(|conn| repo::category::delete(conn, id))
}

#[tauri::command]
pub fn list_goals(db: State<Db>, status: Option<GoalStatus>) -> Result<Vec<GoalSummary>> {
    db.with(|conn| repo::goal::list(conn, status))
}

#[tauri::command]
pub fn get_goal(db: State<Db>, id: i64) -> Result<GoalDetail> {
    db.with(|conn| repo::goal::get_detail(conn, id))
}

#[tauri::command]
pub fn create_goal(db: State<Db>, input: GoalInput) -> Result<Goal> {
    db.with(|conn| repo::goal::create(conn, input))
}

#[tauri::command]
pub fn update_goal(db: State<Db>, id: i64, input: GoalInput) -> Result<Goal> {
    db.with(|conn| repo::goal::update(conn, id, input))
}

#[tauri::command]
pub fn set_goal_status(db: State<Db>, id: i64, status: GoalStatus) -> Result<Goal> {
    db.with(|conn| repo::goal::set_status(conn, id, status))
}

#[tauri::command]
pub fn delete_goal(db: State<Db>, id: i64, delete_orphaned_tasks: bool) -> Result<()> {
    db.with(|conn| repo::goal::delete(conn, id, delete_orphaned_tasks))
}

#[tauri::command]
pub fn list_subgoals(db: State<Db>) -> Result<Vec<Subgoal>> {
    db.with(|conn| repo::subgoal::list_all(conn))
}

#[tauri::command]
pub fn create_subgoal(db: State<Db>, input: SubgoalInput) -> Result<Subgoal> {
    db.with(|conn| repo::subgoal::create(conn, input))
}

#[tauri::command]
pub fn update_subgoal(db: State<Db>, id: i64, input: SubgoalUpdate) -> Result<Subgoal> {
    db.with(|conn| repo::subgoal::update(conn, id, input))
}

#[tauri::command]
pub fn set_subgoal_complete(db: State<Db>, id: i64, is_complete: bool) -> Result<Subgoal> {
    db.with(|conn| repo::subgoal::set_complete(conn, id, is_complete))
}

#[tauri::command]
pub fn delete_subgoal(db: State<Db>, id: i64) -> Result<()> {
    db.with(|conn| repo::subgoal::delete(conn, id))
}

#[tauri::command]
pub fn list_tasks(db: State<Db>) -> Result<Vec<TaskSummary>> {
    db.with(|conn| repo::task::list(conn))
}

#[tauri::command]
pub fn create_task(db: State<Db>, input: TaskInput) -> Result<Task> {
    db.with(|conn| repo::task::create(conn, input))
}

#[tauri::command]
pub fn update_task(db: State<Db>, id: i64, input: TaskUpdate) -> Result<Task> {
    db.with(|conn| repo::task::update(conn, id, input))
}

#[tauri::command]
pub fn set_task_status(db: State<Db>, id: i64, status: TaskStatus) -> Result<Task> {
    db.with(|conn| repo::task::set_status(conn, id, status))
}

#[tauri::command]
pub fn delete_task(db: State<Db>, id: i64) -> Result<()> {
    db.with(|conn| repo::task::delete(conn, id))
}

#[tauri::command]
pub fn list_streaks(db: State<Db>, days: Option<i64>) -> Result<Vec<StreakCard>> {
    let days = days.unwrap_or(repo::streak::DEFAULT_CELL_DAYS);
    db.with(|conn| repo::streak::list(conn, days))
}

/// `date` is a local `YYYY-MM-DD`; omitting it means today, so the frontend
/// never has to decide what "today" is.
#[tauri::command]
pub fn set_task_completion(
    db: State<Db>,
    id: i64,
    date: Option<String>,
    done: bool,
) -> Result<StreakCard> {
    let on = match date {
        Some(text) => Some(
            chrono::NaiveDate::parse_from_str(&text, repo::completion::DATE_FORMAT)
                .map_err(|err| crate::error::Error::Validation(format!("bad date {text}: {err}")))?,
        ),
        None => None,
    };

    db.with(|conn| repo::streak::set_completion(conn, id, on, done, repo::streak::DEFAULT_CELL_DAYS))
}

#[tauri::command]
pub fn set_streak_grace_days(db: State<Db>, days: i64) -> Result<Settings> {
    db.with(|conn| repo::settings::set_grace_days(conn, days))
}

#[tauri::command]
pub fn get_settings(db: State<Db>) -> Result<Settings> {
    db.with(|conn| repo::settings::get(conn))
}

#[tauri::command]
pub fn set_active_theme(db: State<Db>, theme: String) -> Result<Settings> {
    db.with(|conn| repo::settings::set_theme(conn, &theme))
}
