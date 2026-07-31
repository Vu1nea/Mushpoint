//! Data access. Every function takes a `&Connection` so the same code runs
//! against the real database file and against an in-memory one in tests.

pub mod category;
pub mod goal;
pub mod settings;
pub mod subgoal;
pub mod task;

use chrono::{SecondsFormat, Utc};

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
