-- Up Migration
CREATE TABLE entry_editors (
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, user_id)
);

CREATE INDEX entry_editors_updated_at_idx ON entry_editors (updated_at);

-- Down Migration
DROP TABLE entry_editors;
