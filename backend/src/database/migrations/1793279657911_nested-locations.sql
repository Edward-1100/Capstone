-- Up Migration
ALTER TABLE entry_types ADD COLUMN nestable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE entry_types ADD COLUMN any_parent BOOLEAN NOT NULL DEFAULT true;

UPDATE entry_types SET nestable = true WHERE name = 'Locations';

CREATE TABLE type_parent_rules (
  world_id UUID NOT NULL,
  type_id UUID NOT NULL,
  parent_type_id UUID NOT NULL,
  PRIMARY KEY (type_id, parent_type_id),
  FOREIGN KEY (type_id, world_id) REFERENCES entry_types (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_type_id, world_id) REFERENCES entry_types (id, world_id) ON DELETE CASCADE
);

ALTER TABLE entries ADD CONSTRAINT entries_id_world_id_key UNIQUE (id, world_id);
ALTER TABLE entries ADD COLUMN parent_id UUID;
ALTER TABLE entries ADD CONSTRAINT entries_parent_id_world_id_fkey FOREIGN KEY (parent_id, world_id) REFERENCES entries (id, world_id) ON DELETE SET NULL (parent_id);
ALTER TABLE entries ADD CONSTRAINT entries_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
CREATE INDEX entries_parent_idx ON entries (parent_id) WHERE parent_id IS NOT NULL;

CREATE OR REPLACE VIEW active_entries AS
SELECT id, world_id, type_id, name, description, version, created_by, created_at, updated_at, fields, parent_id
FROM entries
WHERE deleted_at IS NULL;

-- Down Migration
DROP VIEW active_entries;

ALTER TABLE entries DROP COLUMN parent_id;
ALTER TABLE entries DROP CONSTRAINT entries_id_world_id_key;

CREATE VIEW active_entries AS
SELECT id, world_id, type_id, name, description, version, created_by, created_at, updated_at, fields
FROM entries
WHERE deleted_at IS NULL;

DROP TABLE type_parent_rules;

ALTER TABLE entry_types DROP COLUMN any_parent;
ALTER TABLE entry_types DROP COLUMN nestable;
