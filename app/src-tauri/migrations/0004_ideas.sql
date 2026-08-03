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
