-- Up Migration
CREATE TABLE entry_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('character', 'location', 'faction', 'event')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, world_id)
);

CREATE UNIQUE INDEX entry_types_world_name_idx ON entry_types (world_id, lower(name));
CREATE INDEX entry_types_world_kind_idx ON entry_types (world_id, kind);

CREATE TABLE entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  type_id UUID,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  purge_after TIMESTAMPTZ,
  FOREIGN KEY (type_id, world_id) REFERENCES entry_types (id, world_id) ON DELETE SET NULL (type_id)
);

CREATE INDEX entries_world_idx ON entries (world_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX entries_type_idx ON entries (type_id);

CREATE VIEW active_entries AS
SELECT id, world_id, type_id, name, description, version, created_by, created_at, updated_at
FROM entries
WHERE deleted_at IS NULL;

CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  entry_name TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_world_idx ON activity_log (world_id, created_at DESC);

INSERT INTO entry_types (world_id, name, kind)
SELECT w.id, t.name, t.kind
FROM worlds w
CROSS JOIN (VALUES ('Characters', 'character'), ('Locations', 'location'), ('Factions', 'faction'), ('Events', 'event')) AS t(name, kind);

-- Down Migration
DROP VIEW active_entries;
DROP TABLE activity_log;
DROP TABLE entries;
DROP TABLE entry_types;
