-- Up Migration
ALTER TABLE worlds ADD COLUMN announcement TEXT NOT NULL DEFAULT '' CHECK (char_length(announcement) <= 1000);
ALTER TABLE worlds ADD COLUMN dashboard_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE featured_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'entry' CHECK (kind IN ('entry', 'relationship', 'details')),
  entry_id UUID,
  relationship_id UUID REFERENCES relationships (id) ON DELETE CASCADE,
  field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout TEXT NOT NULL DEFAULT 'image' CHECK (layout IN ('image', 'text', 'side', 'title', 'plain')),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
  added_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE CASCADE,
  CHECK ((kind = 'relationship') = (relationship_id IS NOT NULL) AND (kind = 'relationship') = (entry_id IS NULL))
);

CREATE UNIQUE INDEX featured_entries_entry_idx ON featured_entries (entry_id) WHERE kind = 'entry';
CREATE UNIQUE INDEX featured_entries_details_idx ON featured_entries (entry_id) WHERE kind = 'details';
CREATE UNIQUE INDEX featured_entries_relationship_idx ON featured_entries (relationship_id) WHERE kind = 'relationship';
CREATE INDEX featured_entries_world_idx ON featured_entries (world_id, created_at DESC);

CREATE TABLE pinned_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'entry' CHECK (kind IN ('entry', 'relationship', 'details')),
  entry_id UUID,
  relationship_id UUID REFERENCES relationships (id) ON DELETE CASCADE,
  field_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  layout TEXT NOT NULL DEFAULT 'image' CHECK (layout IN ('image', 'text', 'side', 'title', 'plain')),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
  note_id UUID REFERENCES notes (id) ON DELETE SET NULL,
  added_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE CASCADE,
  CHECK ((kind = 'relationship') = (relationship_id IS NOT NULL) AND (kind = 'relationship') = (entry_id IS NULL))
);

CREATE UNIQUE INDEX pinned_entries_entry_idx ON pinned_entries (entry_id) WHERE kind = 'entry';
CREATE UNIQUE INDEX pinned_entries_details_idx ON pinned_entries (entry_id) WHERE kind = 'details';
CREATE UNIQUE INDEX pinned_entries_relationship_idx ON pinned_entries (relationship_id) WHERE kind = 'relationship';
CREATE INDEX pinned_entries_world_idx ON pinned_entries (world_id, created_at DESC);

CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  entry_id UUID,
  entry_name TEXT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  anonymous BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
  resolved_by UUID REFERENCES users (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE SET NULL (entry_id)
);

CREATE INDEX suggestions_world_idx ON suggestions (world_id, status, created_at DESC);
CREATE INDEX suggestions_user_idx ON suggestions (user_id, world_id) WHERE status = 'open';

-- Down Migration
DROP TABLE suggestions;
DROP TABLE pinned_entries;
DROP TABLE featured_entries;
ALTER TABLE worlds DROP COLUMN dashboard_settings;
ALTER TABLE worlds DROP COLUMN announcement;
