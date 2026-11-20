-- Up Migration
ALTER TABLE comments ADD COLUMN author_label TEXT;
ALTER TABLE notes ADD COLUMN author_label TEXT;

-- Down Migration
ALTER TABLE notes DROP COLUMN author_label;
ALTER TABLE comments DROP COLUMN author_label;
