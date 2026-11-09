-- Tombstones for deleted accounts: a still-valid token for a deleted user is
-- refused before any route can recreate rows for it. No RLS: the API checks
-- any user id here, and the table holds nothing but ids and times.
CREATE TABLE deleted_users (
  user_id    uuid PRIMARY KEY,
  deleted_at timestamptz NOT NULL
);
GRANT SELECT, INSERT ON deleted_users TO mushpoint_app;

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
