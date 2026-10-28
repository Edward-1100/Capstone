-- Up Migration
CREATE TABLE type_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_id UUID NOT NULL REFERENCES entry_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'long_text', 'number', 'boolean', 'scale', 'choice', 'multi_choice')),
  required BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX type_fields_type_name_idx ON type_fields (type_id, lower(name));

ALTER TABLE entries ADD COLUMN fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE VIEW active_entries AS
SELECT id, world_id, type_id, name, description, version, created_by, created_at, updated_at, fields
FROM entries
WHERE deleted_at IS NULL;

-- Down Migration
DROP VIEW active_entries;

ALTER TABLE entries DROP COLUMN fields;

CREATE VIEW active_entries AS
SELECT id, world_id, type_id, name, description, version, created_by, created_at, updated_at
FROM entries
WHERE deleted_at IS NULL;

DROP TABLE type_fields;
