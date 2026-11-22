-- The profile picture's storage path (`<userId>/<uuid>.<ext>` in the image
-- bucket); null shows the initial instead.
ALTER TABLE profiles ADD COLUMN avatar_path text;
