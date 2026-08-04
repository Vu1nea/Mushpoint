/** Mirrors app/src-tauri/migrations/0001_initial.sql + 0002_streaks.sql + 0003_repo_url.sql + 0004_ideas.sql + 0005_vision_items.sql exactly.
 * Used only to build the in-memory schema for vitest; the real app applies
 * these same statements through the Rust plugin-sql migration registration in
 * src-tauri/src/lib.rs. Keep the two in sync when adding a migration. */
export const TEST_SCHEMA = `
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE,
    color_token TEXT,
    is_default  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL
);

CREATE TABLE goals (
    id                    INTEGER PRIMARY KEY,
    category_id           INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    title                 TEXT    NOT NULL,
    description           TEXT,
    timeframe             TEXT    NOT NULL CHECK (timeframe IN ('short', 'mid', 'long')),
    status                TEXT    NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'completed', 'archived')),
    due_date              TEXT,
    motivation_text       TEXT,
    motivation_image_path TEXT,
    repo_url              TEXT,
    created_at            TEXT    NOT NULL,
    updated_at            TEXT    NOT NULL
);

CREATE INDEX idx_goals_category ON goals(category_id);
CREATE INDEX idx_goals_status ON goals(status);

CREATE TABLE subgoals (
    id          INTEGER PRIMARY KEY,
    goal_id     INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title       TEXT    NOT NULL,
    due_date    TEXT,
    is_complete INTEGER NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
);

CREATE INDEX idx_subgoals_goal ON subgoals(goal_id);

CREATE TABLE tasks (
    id           INTEGER PRIMARY KEY,
    title        TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'todo'
                         CHECK (status IN ('todo', 'in_progress', 'done')),
    due_date     TEXT,
    goal_id      INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    subgoal_id   INTEGER REFERENCES subgoals(id) ON DELETE SET NULL,
    recurrence   TEXT CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekdays', 'weekly')),
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_tasks_goal ON tasks(goal_id);
CREATE INDEX idx_tasks_subgoal ON tasks(subgoal_id);

CREATE TABLE settings (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    active_theme TEXT    NOT NULL DEFAULT 'nocturne',
    streak_grace_days INTEGER NOT NULL DEFAULT 2 CHECK (streak_grace_days BETWEEN 0 AND 7),
    updated_at   TEXT    NOT NULL
);

INSERT INTO settings (id, active_theme, updated_at)
VALUES (1, 'nocturne', datetime('now'));

INSERT INTO categories (name, color_token, is_default, created_at) VALUES
    ('Work',          'accent-primary',   1, datetime('now')),
    ('Gym',           'accent-secondary', 1, datetime('now')),
    ('School',        'accent-tertiary',  1, datetime('now')),
    ('Side Projects', 'accent-primary',   1, datetime('now')),
    ('Social',        'accent-secondary', 1, datetime('now'));

CREATE TABLE task_completions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT    NOT NULL,
    created_at   TEXT    NOT NULL,
    UNIQUE (task_id, completed_on)
);

CREATE INDEX idx_completions_task ON task_completions(task_id, completed_on);

CREATE TABLE ideas (
    id                INTEGER PRIMARY KEY,
    title             TEXT    NOT NULL,
    note              TEXT,
    promoted_goal_id  INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    created_at        TEXT    NOT NULL,
    updated_at        TEXT    NOT NULL
);
CREATE INDEX idx_ideas_promoted ON ideas(promoted_goal_id);

CREATE TABLE idea_tags (
    id         INTEGER PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL
);

CREATE TABLE idea_tag_links (
    idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES idea_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (idea_id, tag_id)
);
CREATE INDEX idx_idea_tag_links_tag ON idea_tag_links(tag_id);

CREATE TABLE vision_items (
    id           INTEGER PRIMARY KEY,
    image_path   TEXT,
    quote_text   TEXT,
    position     INTEGER NOT NULL,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    CHECK (image_path IS NOT NULL OR quote_text IS NOT NULL)
);
CREATE INDEX idx_vision_items_position ON vision_items(position);
`;
