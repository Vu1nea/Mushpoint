-- Policies apply to the API role only. With no TO clause they applied to PUBLIC,
-- which on Supabase includes the anon/authenticated roles behind its Data API.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','goals','subgoals','tasks','task_completions',
                           'settings','ideas','idea_tags','idea_tag_links','vision_items']
  LOOP
    EXECUTE format('DROP POLICY own_rows ON %I', t);
    EXECUTE format('CREATE POLICY own_rows ON %I TO mushpoint_app USING (user_id = current_setting(''app.user_id'')::uuid)', t);
  END LOOP;
END $$;

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
