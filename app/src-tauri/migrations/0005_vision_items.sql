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
