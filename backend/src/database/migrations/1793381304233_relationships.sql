-- Up Migration
CREATE TABLE relationship_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_symmetric BOOLEAN NOT NULL DEFAULT false,
  from_any BOOLEAN NOT NULL DEFAULT true,
  to_any BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, world_id)
);

CREATE UNIQUE INDEX relationship_types_world_name_idx ON relationship_types (world_id, lower(name));

CREATE TABLE relationship_type_ends (
  world_id UUID NOT NULL,
  relationship_type_id UUID NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('from', 'to')),
  entry_type_id UUID NOT NULL,
  PRIMARY KEY (relationship_type_id, side, entry_type_id),
  FOREIGN KEY (relationship_type_id, world_id) REFERENCES relationship_types (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (entry_type_id, world_id) REFERENCES entry_types (id, world_id) ON DELETE CASCADE
);

CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL,
  relationship_type_id UUID NOT NULL,
  from_entry_id UUID NOT NULL,
  to_entry_id UUID NOT NULL,
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_entry_id <> to_entry_id),
  UNIQUE (relationship_type_id, from_entry_id, to_entry_id),
  FOREIGN KEY (relationship_type_id, world_id) REFERENCES relationship_types (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (from_entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (to_entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE CASCADE
);

CREATE INDEX relationships_from_idx ON relationships (from_entry_id);
CREATE INDEX relationships_to_idx ON relationships (to_entry_id);

-- Down Migration
DROP TABLE relationships;
DROP TABLE relationship_type_ends;
DROP TABLE relationship_types;
