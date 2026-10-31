-- Up Migration
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT CHECK (color ~ '^#[0-9a-f]{6}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, world_id)
);

CREATE UNIQUE INDEX tags_world_name_idx ON tags (world_id, lower(name));

CREATE TABLE entry_tags (
  entry_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  world_id UUID NOT NULL,
  PRIMARY KEY (entry_id, tag_id),
  FOREIGN KEY (entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id, world_id) REFERENCES tags (id, world_id) ON DELETE CASCADE
);

CREATE INDEX entry_tags_tag_idx ON entry_tags (tag_id);

-- Down Migration
DROP TABLE entry_tags;
DROP TABLE tags;
