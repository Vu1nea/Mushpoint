use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ToSql, ToSqlOutput, ValueRef};
use serde::{Deserialize, Serialize};

/// Declares an enum that round-trips through SQLite as TEXT and through serde as
/// snake_case, so the stored value, the JSON value and the Rust variant never drift.
macro_rules! sql_enum {
    ($name:ident { $($variant:ident => $text:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        #[serde(rename_all = "snake_case")]
        pub enum $name {
            $($variant),+
        }

        impl $name {
            pub fn as_str(&self) -> &'static str {
                match self { $(Self::$variant => $text),+ }
            }

            pub fn parse(value: &str) -> Option<Self> {
                match value { $($text => Some(Self::$variant),)+ _ => None }
            }
        }

        impl ToSql for $name {
            fn to_sql(&self) -> rusqlite::Result<ToSqlOutput<'_>> {
                Ok(ToSqlOutput::from(self.as_str()))
            }
        }

        impl FromSql for $name {
            fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
                let text = value.as_str()?;
                Self::parse(text).ok_or_else(|| {
                    FromSqlError::Other(
                        format!("invalid {} value: {text}", stringify!($name)).into(),
                    )
                })
            }
        }
    };
}

sql_enum!(Timeframe {
    Short => "short",
    Mid => "mid",
    Long => "long",
});

sql_enum!(GoalStatus {
    Active => "active",
    Completed => "completed",
    Archived => "archived",
});

sql_enum!(TaskStatus {
    Todo => "todo",
    InProgress => "in_progress",
    Done => "done",
});

impl TaskStatus {
    /// A task counts toward progress only once it is done; `in_progress` is a
    /// workflow state, not partial credit.
    pub fn completion(&self) -> f64 {
        match self {
            TaskStatus::Done => 1.0,
            _ => 0.0,
        }
    }
}

sql_enum!(Recurrence {
    Daily => "daily",
    Weekdays => "weekdays",
    Weekly => "weekly",
});

/// How one calendar day reads on a streak heatmap.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CellState {
    /// The occurrence was satisfied — on the day itself or within the grace window.
    Done,
    /// The window closed with nothing logged.
    Missed,
    /// Nothing logged yet, but the window is still open.
    Pending,
    /// The cadence does not expect this day at all.
    NotExpected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    /// Semantic theme token name (e.g. `accent-secondary`), never a raw hex value.
    pub color_token: Option<String>,
    pub is_default: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryInput {
    pub name: String,
    pub color_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub id: i64,
    pub category_id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub timeframe: Timeframe,
    pub status: GoalStatus,
    pub due_date: Option<String>,
    pub motivation_text: Option<String>,
    pub motivation_image_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalInput {
    pub category_id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub timeframe: Timeframe,
    pub due_date: Option<String>,
    pub motivation_text: Option<String>,
    pub motivation_image_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subgoal {
    pub id: i64,
    pub goal_id: i64,
    pub title: String,
    pub due_date: Option<String>,
    pub is_complete: bool,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubgoalInput {
    pub goal_id: i64,
    pub title: String,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubgoalUpdate {
    pub title: String,
    pub due_date: Option<String>,
    pub is_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub status: TaskStatus,
    pub due_date: Option<String>,
    pub goal_id: Option<i64>,
    pub subgoal_id: Option<i64>,
    /// `None` means a one-off task. Anything else makes it a habit with a streak.
    pub recurrence: Option<Recurrence>,
    pub created_at: String,
    pub updated_at: String,
}

impl Task {
    pub fn is_recurring(&self) -> bool {
        self.recurrence.is_some()
    }

    /// A habit has no end state, so it is not a fraction of anything its parent
    /// goal can be "done" with — it is left out of the progress average entirely.
    pub fn counts_toward_progress(&self) -> bool {
        self.recurrence.is_none()
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub title: String,
    pub due_date: Option<String>,
    pub goal_id: Option<i64>,
    pub subgoal_id: Option<i64>,
    #[serde(default)]
    pub recurrence: Option<Recurrence>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskUpdate {
    pub title: String,
    pub status: TaskStatus,
    pub due_date: Option<String>,
    pub goal_id: Option<i64>,
    pub subgoal_id: Option<i64>,
    #[serde(default)]
    pub recurrence: Option<Recurrence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub active_theme: String,
    pub updated_at: String,
}

/// A goal as it appears in list views: the record plus its derived numbers.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalSummary {
    #[serde(flatten)]
    pub goal: Goal,
    pub progress: f64,
    pub subgoal_count: usize,
    pub task_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubgoalDetail {
    #[serde(flatten)]
    pub subgoal: Subgoal,
    pub progress: f64,
    pub tasks: Vec<Task>,
}

/// Everything the goal detail screen needs in one round trip.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalDetail {
    #[serde(flatten)]
    pub goal: Goal,
    pub progress: f64,
    pub category: Option<Category>,
    pub subgoals: Vec<SubgoalDetail>,
    /// Tasks linked straight to the goal, with no subgoal in between.
    pub direct_tasks: Vec<Task>,
}
