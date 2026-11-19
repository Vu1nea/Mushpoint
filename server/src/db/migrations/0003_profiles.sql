CREATE TABLE profiles (
  user_id    uuid PRIMARY KEY DEFAULT current_setting('app.user_id')::uuid,
  username   text NOT NULL,
  updated_at text NOT NULL
);
CREATE UNIQUE INDEX profiles_username_lower ON profiles (lower(username));

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON profiles TO mushpoint_app USING (user_id = current_setting('app.user_id')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO mushpoint_app;

-- Supabase grants anon/authenticated full access to new public tables by default.
-- Plain Postgres has no such roles, so the revokes are guarded.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
    END IF;
  END LOOP;
END $$;
