-- Up Migration
CREATE UNIQUE INDEX users_username_lower_idx ON users (lower(username));

ALTER TABLE world_members ADD COLUMN invited_role TEXT CHECK (invited_role = 'editor');
ALTER TABLE world_members ADD COLUMN invited_by UUID REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE world_members ADD CONSTRAINT world_members_invited_role_viewer CHECK (invited_role IS NULL OR role = 'viewer');

CREATE TABLE world_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX world_invite_links_world_idx ON world_invite_links (world_id);

CREATE TABLE user_blocks (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_user_id),
  CHECK (user_id <> blocked_user_id)
);

-- Down Migration
DROP TABLE user_blocks;
DROP TABLE world_invite_links;
ALTER TABLE world_members DROP CONSTRAINT world_members_invited_role_viewer;
ALTER TABLE world_members DROP COLUMN invited_by;
ALTER TABLE world_members DROP COLUMN invited_role;
DROP INDEX users_username_lower_idx;
