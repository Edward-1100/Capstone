-- Up Migration
ALTER TABLE entry_types ADD COLUMN nest_mode TEXT NOT NULL DEFAULT 'none' CHECK (nest_mode IN ('none', 'chosen', 'all', 'own'));

DELETE FROM type_parent_rules r
USING entry_types c, entry_types p
WHERE c.id = r.type_id AND p.id = r.parent_type_id AND (NOT c.nestable OR NOT p.nestable);

INSERT INTO type_parent_rules (world_id, type_id, parent_type_id)
SELECT c.world_id, c.id, p.id
FROM entry_types c
JOIN entry_types p ON p.world_id = c.world_id AND p.nestable
WHERE c.nestable AND c.any_parent
ON CONFLICT DO NOTHING;

UPDATE entry_types SET nest_mode = 'chosen' WHERE nestable;

UPDATE entry_types t SET nest_mode = 'own'
WHERE t.nest_mode = 'chosen'
  AND EXISTS (SELECT 1 FROM type_parent_rules r WHERE r.type_id = t.id AND r.parent_type_id = t.id)
  AND NOT EXISTS (SELECT 1 FROM type_parent_rules r WHERE r.type_id = t.id AND r.parent_type_id <> t.id);

DELETE FROM type_parent_rules r USING entry_types t WHERE t.id = r.type_id AND t.nest_mode = 'own';

ALTER TABLE entry_types DROP COLUMN any_parent;
ALTER TABLE entry_types DROP COLUMN nestable;

-- Down Migration
ALTER TABLE entry_types ADD COLUMN nestable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE entry_types ADD COLUMN any_parent BOOLEAN NOT NULL DEFAULT true;

INSERT INTO type_parent_rules (world_id, type_id, parent_type_id)
SELECT world_id, id, id FROM entry_types WHERE nest_mode = 'own'
ON CONFLICT DO NOTHING;

UPDATE entry_types SET nestable = (nest_mode <> 'none'), any_parent = (nest_mode IN ('none', 'all'));

ALTER TABLE entry_types DROP COLUMN nest_mode;
