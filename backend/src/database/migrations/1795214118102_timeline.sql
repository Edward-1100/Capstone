-- Up Migration
ALTER TABLE entry_types ADD COLUMN timelineable BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE timeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  entry_id UUID NOT NULL UNIQUE,
  start_year INTEGER NOT NULL CHECK (start_year BETWEEN -1000000 AND 1000000),
  start_month SMALLINT CHECK (start_month BETWEEN 1 AND 12),
  start_day SMALLINT CHECK (start_day BETWEEN 1 AND 31),
  start_hour SMALLINT CHECK (start_hour BETWEEN 0 AND 23),
  start_minute SMALLINT CHECK (start_minute BETWEEN 0 AND 59),
  end_year INTEGER CHECK (end_year BETWEEN -1000000 AND 1000000),
  end_month SMALLINT CHECK (end_month BETWEEN 1 AND 12),
  end_day SMALLINT CHECK (end_day BETWEEN 1 AND 31),
  end_hour SMALLINT CHECK (end_hour BETWEEN 0 AND 23),
  end_minute SMALLINT CHECK (end_minute BETWEEN 0 AND 59),
  color TEXT CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_year IS NULL OR end_year >= start_year),
  CONSTRAINT timeline_entries_start_parts CHECK (
    (start_day IS NULL OR start_month IS NOT NULL)
    AND (start_hour IS NULL OR start_day IS NOT NULL)
    AND (start_minute IS NULL OR start_hour IS NOT NULL)
  ),
  CONSTRAINT timeline_entries_end_parts CHECK (
    (end_year IS NOT NULL OR (end_month IS NULL AND end_day IS NULL AND end_hour IS NULL AND end_minute IS NULL))
    AND (end_day IS NULL OR end_month IS NOT NULL)
    AND (end_hour IS NULL OR end_day IS NOT NULL)
    AND (end_minute IS NULL OR end_hour IS NOT NULL)
  ),
  FOREIGN KEY (entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE CASCADE
);

CREATE INDEX timeline_entries_world_idx ON timeline_entries (world_id, start_year);

-- Down Migration
DROP TABLE timeline_entries;

ALTER TABLE entry_types DROP COLUMN timelineable;
