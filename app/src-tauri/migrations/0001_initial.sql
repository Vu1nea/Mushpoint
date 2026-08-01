
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
    is_recurring INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
);

CREATE INDEX idx_tasks_goal ON tasks(goal_id);
CREATE INDEX idx_tasks_subgoal ON tasks(subgoal_id);

-- Single-row table: this app has exactly one local user, so there is nothing to key on.
CREATE TABLE settings (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    active_theme TEXT    NOT NULL DEFAULT 'nocturne',
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
