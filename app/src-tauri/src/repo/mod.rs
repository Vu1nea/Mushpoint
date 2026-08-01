//! Data access. Every function takes a `&Connection` so the same code runs
//! against the real database file and against an in-memory one in tests.

pub mod category;
pub mod completion;
pub mod goal;
pub mod settings;
pub mod streak;
pub mod subgoal;
pub mod task;

use chrono::{DateTime, Local, NaiveDate, SecondsFormat, Utc};

use crate::error::{Error, Result};

/// Timestamps are stored as UTC RFC 3339 strings — sortable as text, and
/// unambiguous when exported to JSON.
pub fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

/// Trims a user-supplied name/title and rejects it if nothing is left.
pub fn required_text(field: &str, value: &str) -> Result<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(Error::Validation(format!("{field} cannot be empty")));
    }
    Ok(trimmed.to_string())
}

/// Trims an optional field, treating whitespace-only input as absent so the
/// database never holds a mix of NULL and "" for the same meaning.
pub fn optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
}

/// Streaks are reckoned in local calendar days: a habit checked off at 11pm
/// belongs to that evening, not to tomorrow in UTC.
pub fn today() -> NaiveDate {
    Local::now().date_naive()
}

/// The local calendar day a stored RFC 3339 timestamp fell on.
pub fn local_date_of(timestamp: &str) -> Result<NaiveDate> {
    DateTime::parse_from_rfc3339(timestamp)
        .map(|moment| moment.with_timezone(&Local).date_naive())
        .map_err(|err| Error::Validation(format!("unreadable timestamp {timestamp}: {err}")))
}
