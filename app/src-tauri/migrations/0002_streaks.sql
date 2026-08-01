-- One cadence column replaces the boolean: "recurring" now means "has a recurrence",
-- so `is_recurring = 1, recurrence IS NULL` cannot be represented at all.
ALTER TABLE tasks ADD COLUMN recurrence TEXT
    CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekdays', 'weekly'));

UPDATE tasks SET recurrence = 'daily' WHERE is_recurring = 1;

ALTER TABLE tasks DROP COLUMN is_recurring;

-- `completed_on` is a LOCAL calendar date, never a UTC instant: a habit checked
-- off at 11pm belongs to that evening, not to tomorrow in UTC.
CREATE TABLE task_completions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    completed_on TEXT    NOT NULL,
    created_at   TEXT    NOT NULL,
    UNIQUE (task_id, completed_on)
);

CREATE INDEX idx_completions_task ON task_completions(task_id, completed_on);

ALTER TABLE settings ADD COLUMN streak_grace_days INTEGER NOT NULL DEFAULT 2
    CHECK (streak_grace_days BETWEEN 0 AND 7);
