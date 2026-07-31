use rusqlite::{params, Connection, Row};

use super::{now, optional_text, required_text};
use crate::error::{Error, Result};
use crate::models::{Category, CategoryInput};

const COLUMNS: &str = "id, name, color_token, is_default, created_at";

fn map(row: &Row) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get("id")?,
        name: row.get("name")?,
        color_token: row.get("color_token")?,
        is_default: row.get("is_default")?,
        created_at: row.get("created_at")?,
    })
}

pub fn list(conn: &Connection) -> Result<Vec<Category>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM categories ORDER BY is_default DESC, name"
    ))?;
    let categories = stmt.query_map([], map)?.collect::<rusqlite::Result<_>>()?;
    Ok(categories)
}

pub fn get(conn: &Connection, id: i64) -> Result<Category> {
    conn.query_row(
        &format!("SELECT {COLUMNS} FROM categories WHERE id = ?1"),
        params![id],
        map,
    )
    .map_err(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => Error::not_found("category", id),
        other => other.into(),
    })
}

pub fn create(conn: &Connection, input: CategoryInput) -> Result<Category> {
    let name = required_text("category name", &input.name)?;
    conn.execute(
        "INSERT INTO categories (name, color_token, is_default, created_at)
         VALUES (?1, ?2, 0, ?3)",
        params![name, optional_text(input.color_token), now()],
    )
    .map_err(duplicate_name_as_validation)?;

    get(conn, conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, input: CategoryInput) -> Result<Category> {
    let name = required_text("category name", &input.name)?;
    let changed = conn
        .execute(
            "UPDATE categories SET name = ?1, color_token = ?2 WHERE id = ?3",
            params![name, optional_text(input.color_token), id],
        )
        .map_err(duplicate_name_as_validation)?;

    if changed == 0 {
        return Err(Error::not_found("category", id));
    }
    get(conn, id)
}

/// Goals in a deleted category keep existing; their `category_id` becomes NULL
/// (see the ON DELETE SET NULL rule in the schema).
pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    let changed = conn.execute("DELETE FROM categories WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(Error::not_found("category", id));
    }
    Ok(())
}

/// The UNIQUE(name) constraint is a user-facing rule, not an internal failure.
fn duplicate_name_as_validation(err: rusqlite::Error) -> Error {
    match &err {
        rusqlite::Error::SqliteFailure(inner, _)
            if inner.code == rusqlite::ErrorCode::ConstraintViolation =>
        {
            Error::Validation("a category with that name already exists".into())
        }
        _ => err.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn input(name: &str) -> CategoryInput {
        CategoryInput {
            name: name.to_string(),
            color_token: None,
        }
    }

    #[test]
    fn lists_the_five_seeded_defaults() {
        let conn = db::open_in_memory().unwrap();
        assert_eq!(list(&conn).unwrap().len(), 5);
    }

    #[test]
    fn creates_a_custom_category() {
        let conn = db::open_in_memory().unwrap();
        let created = create(&conn, input("  Reading  ")).unwrap();

        assert_eq!(created.name, "Reading");
        assert!(!created.is_default);
    }

    #[test]
    fn rejects_a_blank_name() {
        let conn = db::open_in_memory().unwrap();
        let err = create(&conn, input("   ")).unwrap_err();

        assert_eq!(err.kind(), "validation");
    }

    #[test]
    fn rejects_a_duplicate_name() {
        let conn = db::open_in_memory().unwrap();
        let err = create(&conn, input("Gym")).unwrap_err();

        assert_eq!(err.kind(), "validation");
    }

    #[test]
    fn updates_and_deletes() {
        let conn = db::open_in_memory().unwrap();
        let created = create(&conn, input("Readin")).unwrap();

        let renamed = update(&conn, created.id, input("Reading")).unwrap();
        assert_eq!(renamed.name, "Reading");

        delete(&conn, created.id).unwrap();
        assert_eq!(get(&conn, created.id).unwrap_err().kind(), "not_found");
    }

    #[test]
    fn reports_missing_categories() {
        let conn = db::open_in_memory().unwrap();

        assert_eq!(
            update(&conn, 999, input("Nope")).unwrap_err().kind(),
            "not_found"
        );
        assert_eq!(delete(&conn, 999).unwrap_err().kind(), "not_found");
    }
}
