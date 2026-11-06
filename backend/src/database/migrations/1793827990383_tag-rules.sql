-- Up Migration
ALTER TABLE tags ADD COLUMN rule_match TEXT NOT NULL DEFAULT 'all' CHECK (rule_match IN ('all', 'any'));

CREATE TABLE tag_rule_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  exclude BOOLEAN NOT NULL DEFAULT false,
  kind TEXT NOT NULL CHECK (kind IN ('type', 'relationship', 'inside')),
  entry_type_id UUID,
  relationship_type_id UUID,
  side TEXT CHECK (side IN ('from', 'to', 'either')),
  other_any BOOLEAN NOT NULL DEFAULT true,
  other_entry_id UUID,
  inside_entry_id UUID,
  FOREIGN KEY (tag_id, world_id) REFERENCES tags (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (entry_type_id, world_id) REFERENCES entry_types (id, world_id) ON DELETE SET NULL (entry_type_id),
  FOREIGN KEY (relationship_type_id, world_id) REFERENCES relationship_types (id, world_id) ON DELETE SET NULL (relationship_type_id),
  FOREIGN KEY (other_entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE SET NULL (other_entry_id),
  FOREIGN KEY (inside_entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE SET NULL (inside_entry_id)
);

CREATE INDEX tag_rule_conditions_tag_idx ON tag_rule_conditions (tag_id, position);

CREATE TABLE tag_rule_entries (
  world_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  entry_id UUID NOT NULL,
  exclude BOOLEAN NOT NULL,
  PRIMARY KEY (tag_id, entry_id),
  FOREIGN KEY (tag_id, world_id) REFERENCES tags (id, world_id) ON DELETE CASCADE,
  FOREIGN KEY (entry_id, world_id) REFERENCES entries (id, world_id) ON DELETE CASCADE
);

CREATE FUNCTION entry_ancestors(start_id UUID) RETURNS SETOF UUID LANGUAGE sql STABLE AS $$
  WITH RECURSIVE up(id) AS (
    SELECT parent_id FROM entries WHERE id = start_id AND parent_id IS NOT NULL
    UNION
    SELECT p.parent_id FROM entries p JOIN up ON p.id = up.id WHERE p.parent_id IS NOT NULL
  )
  SELECT id FROM up
$$;

CREATE FUNCTION tag_condition_matches(c tag_rule_conditions, p_entry UUID, p_type UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT CASE c.kind
    WHEN 'type' THEN COALESCE(p_type = c.entry_type_id, false)
    WHEN 'relationship' THEN EXISTS (
      SELECT 1 FROM relationships r
      WHERE r.relationship_type_id = c.relationship_type_id
        AND (
          (c.side IN ('from', 'either') AND r.from_entry_id = p_entry
            AND (c.other_any OR r.to_entry_id = c.other_entry_id)
            AND EXISTS (SELECT 1 FROM active_entries o WHERE o.id = r.to_entry_id))
          OR
          (c.side IN ('to', 'either') AND r.to_entry_id = p_entry
            AND (c.other_any OR r.from_entry_id = c.other_entry_id)
            AND EXISTS (SELECT 1 FROM active_entries o WHERE o.id = r.from_entry_id))
        )
    )
    WHEN 'inside' THEN EXISTS (SELECT 1 FROM entry_ancestors(p_entry) AS a(id) WHERE a.id = c.inside_entry_id)
    ELSE false
  END
$$;

CREATE FUNCTION tag_condition_broken(c tag_rule_conditions) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT CASE c.kind
    WHEN 'type' THEN c.entry_type_id IS NULL
    WHEN 'relationship' THEN c.relationship_type_id IS NULL
      OR (NOT c.other_any AND NOT EXISTS (SELECT 1 FROM active_entries o WHERE o.id = c.other_entry_id))
    WHEN 'inside' THEN NOT EXISTS (SELECT 1 FROM active_entries o WHERE o.id = c.inside_entry_id)
    ELSE true
  END
$$;

CREATE VIEW paused_tag_rules AS
SELECT DISTINCT c.tag_id, c.world_id
FROM tag_rule_conditions c
WHERE tag_condition_broken(c);

CREATE VIEW auto_entry_tags AS
SELECT e.id AS entry_id, t.id AS tag_id, t.world_id
FROM tags t
JOIN active_entries e ON e.world_id = t.world_id
WHERE NOT EXISTS (SELECT 1 FROM tag_rule_entries x WHERE x.tag_id = t.id AND x.entry_id = e.id AND x.exclude)
  AND (
    EXISTS (SELECT 1 FROM tag_rule_entries x WHERE x.tag_id = t.id AND x.entry_id = e.id AND NOT x.exclude)
    OR (
      NOT EXISTS (SELECT 1 FROM paused_tag_rules p WHERE p.tag_id = t.id)
      AND EXISTS (SELECT 1 FROM tag_rule_conditions c WHERE c.tag_id = t.id AND NOT c.exclude)
      AND NOT EXISTS (SELECT 1 FROM tag_rule_conditions c WHERE c.tag_id = t.id AND c.exclude AND tag_condition_matches(c, e.id, e.type_id))
      AND CASE t.rule_match
        WHEN 'any' THEN EXISTS (SELECT 1 FROM tag_rule_conditions c WHERE c.tag_id = t.id AND NOT c.exclude AND tag_condition_matches(c, e.id, e.type_id))
        ELSE NOT EXISTS (SELECT 1 FROM tag_rule_conditions c WHERE c.tag_id = t.id AND NOT c.exclude AND NOT tag_condition_matches(c, e.id, e.type_id))
      END
    )
  );

CREATE VIEW effective_entry_tags AS
SELECT entry_id, tag_id, world_id, false AS auto
FROM entry_tags
UNION ALL
SELECT a.entry_id, a.tag_id, a.world_id, true AS auto
FROM auto_entry_tags a
WHERE NOT EXISTS (SELECT 1 FROM entry_tags m WHERE m.entry_id = a.entry_id AND m.tag_id = a.tag_id);

-- Down Migration
DROP VIEW effective_entry_tags;
DROP VIEW auto_entry_tags;
DROP VIEW paused_tag_rules;
DROP FUNCTION tag_condition_broken(tag_rule_conditions);
DROP FUNCTION tag_condition_matches(tag_rule_conditions, UUID, UUID);
DROP FUNCTION entry_ancestors(UUID);
DROP TABLE tag_rule_entries;
DROP TABLE tag_rule_conditions;
ALTER TABLE tags DROP COLUMN rule_match;