-- Up Migration
ALTER TABLE entry_types ADD COLUMN mappable BOOLEAN NOT NULL DEFAULT false;

UPDATE entry_types SET mappable = true WHERE name IN ('Characters', 'Locations', 'Events');

ALTER TABLE worlds ADD COLUMN max_maps INTEGER NOT NULL DEFAULT 6 CHECK (max_maps >= 0);

ALTER TABLE entry_images ADD CONSTRAINT entry_images_id_entry_id_key UNIQUE (id, entry_id);

CREATE TABLE maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  storage_key TEXT NOT NULL,
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, world_id)
);

CREATE INDEX maps_world_idx ON maps (world_id);

CREATE TABLE map_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id UUID NOT NULL,
  world_id UUID NOT NULL,
  entry_id UUID NOT NULL,
  image_id UUID,
  color TEXT NOT NULL DEFAULT '#d93025' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  inner_color TEXT NOT NULL DEFAULT '#ffffff' CHECK (inner_color ~ '^#[0-9a-fA-F]{6}$'),
  image_scale DOUBLE PRECISION NOT NULL DEFAULT 1 CHECK (image_scale BETWEEN 1 AND 4),
  image_x DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (image_x BETWEEN -1 AND 1),
  image_y DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (image_y BETWEEN -1 AND 1),
  x DOUBLE PRECISION NOT NULL CHECK (x BETWEEN 0 AND 1),
  y DOUBLE PRECISION NOT NULL CHECK (y BETWEEN 0 AND 1),
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (map_id, entry_id),
  FOREIGN KEY (map_id, world_id) REFERENCES maps (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (image_id, entry_id) REFERENCES entry_images (id, entry_id) ON DELETE SET NULL (image_id)
);

CREATE INDEX map_markers_entry_idx ON map_markers (entry_id);

-- Down Migration
DROP TABLE map_markers;
DROP TABLE maps;
ALTER TABLE entry_images DROP CONSTRAINT entry_images_id_entry_id_key;
ALTER TABLE worlds DROP COLUMN max_maps;
ALTER TABLE entry_types DROP COLUMN mappable;
