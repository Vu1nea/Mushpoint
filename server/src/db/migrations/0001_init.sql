DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mushpoint_app') THEN
    CREATE ROLE mushpoint_app LOGIN NOBYPASSRLS;
  END IF;
END $$;

CREATE TABLE categories (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  name        text NOT NULL,
  color_token text,
  is_default  integer NOT NULL DEFAULT 0,
  created_at  text NOT NULL
);
CREATE UNIQUE INDEX idx_categories_user_name ON categories(user_id, name);

CREATE TABLE goals (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  category_id           bigint REFERENCES categories(id) ON DELETE SET NULL,
  title                 text NOT NULL,
  description           text,
  timeframe             text NOT NULL CHECK (timeframe IN ('short', 'mid', 'long')),
  status                text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  due_date              text,
  motivation_text       text,
  motivation_image_path text,
  repo_url              text,
  created_at            text NOT NULL,
  updated_at            text NOT NULL
);
CREATE INDEX idx_goals_category ON goals(category_id);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_goals_user ON goals(user_id);

CREATE TABLE subgoals (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  goal_id     bigint NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title       text NOT NULL,
  due_date    text,
  is_complete integer NOT NULL DEFAULT 0,
  position    integer NOT NULL DEFAULT 0,
  created_at  text NOT NULL,
  updated_at  text NOT NULL
);
CREATE INDEX idx_subgoals_goal ON subgoals(goal_id);

CREATE TABLE tasks (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  title      text NOT NULL,
  status     text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date   text,
  goal_id    bigint REFERENCES goals(id) ON DELETE SET NULL,
  subgoal_id bigint REFERENCES subgoals(id) ON DELETE SET NULL,
  recurrence text CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekdays', 'weekly')),
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX idx_tasks_goal ON tasks(goal_id);
CREATE INDEX idx_tasks_subgoal ON tasks(subgoal_id);
CREATE INDEX idx_tasks_user ON tasks(user_id);

CREATE TABLE task_completions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  task_id      bigint NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_on text NOT NULL,
  created_at   text NOT NULL,
  UNIQUE (task_id, completed_on)
);
CREATE INDEX idx_completions_task ON task_completions(task_id, completed_on);

CREATE TABLE settings (
  user_id           uuid PRIMARY KEY DEFAULT current_setting('app.user_id')::uuid,
  active_theme      text NOT NULL DEFAULT 'nocturne',
  streak_grace_days integer NOT NULL DEFAULT 2 CHECK (streak_grace_days BETWEEN 0 AND 7),
  updated_at        text NOT NULL
);

CREATE TABLE ideas (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  title            text NOT NULL,
  note             text,
  promoted_goal_id bigint REFERENCES goals(id) ON DELETE SET NULL,
  created_at       text NOT NULL,
  updated_at       text NOT NULL
);
CREATE INDEX idx_ideas_promoted ON ideas(promoted_goal_id);
CREATE INDEX idx_ideas_user ON ideas(user_id);

CREATE TABLE idea_tags (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  name       text NOT NULL,
  created_at text NOT NULL
);
CREATE UNIQUE INDEX idx_idea_tags_user_name ON idea_tags(user_id, lower(name));

CREATE TABLE idea_tag_links (
  user_id uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  idea_id bigint NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  tag_id  bigint NOT NULL REFERENCES idea_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, tag_id)
);
CREATE INDEX idx_idea_tag_links_tag ON idea_tag_links(tag_id);

CREATE TABLE vision_items (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid NOT NULL DEFAULT current_setting('app.user_id')::uuid,
  image_path text,
  quote_text text,
  position   integer NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  CHECK (image_path IS NOT NULL OR quote_text IS NOT NULL)
);
CREATE INDEX idx_vision_items_position ON vision_items(position);
CREATE INDEX idx_vision_items_user ON vision_items(user_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','goals','subgoals','tasks','task_completions',
                           'settings','ideas','idea_tags','idea_tag_links','vision_items']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY own_rows ON %I USING (user_id = current_setting(''app.user_id'')::uuid)', t);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO mushpoint_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mushpoint_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mushpoint_app;
REVOKE ALL ON schema_migrations FROM mushpoint_app;
