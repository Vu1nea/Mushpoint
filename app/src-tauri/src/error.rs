use serde::{Serialize, Serializer};

/// Every failure the frontend can observe. Serialized as `{ kind, message }` so
/// the UI can branch on `kind` for error states instead of matching on strings.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    Validation(String),

    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Tauri(#[from] tauri::Error),
}

impl Error {
    pub fn kind(&self) -> &'static str {
        match self {
            Error::NotFound(_) => "not_found",
            Error::Validation(_) => "validation",
            Error::Database(_) => "database",
            Error::Io(_) | Error::Tauri(_) => "internal",
        }
    }

    pub fn not_found(entity: &str, id: i64) -> Self {
        Error::NotFound(format!("{entity} {id} not found"))
    }
}

#[derive(Serialize)]
struct ErrorPayload<'a> {
    kind: &'a str,
    message: String,
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        ErrorPayload {
            kind: self.kind(),
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}

pub type Result<T> = std::result::Result<T, Error>;
