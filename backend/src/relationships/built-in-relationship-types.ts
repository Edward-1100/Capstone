import { PoolClient } from 'pg';

export const BUILT_IN_RELATIONSHIP_TYPES = [
  {name: 'Friend', description: 'Two characters who are friends', symmetric: true, from: ['Characters'], to: ['Characters']},
  {name: 'Enemy', description: 'Two characters who are enemies', symmetric: true, from: ['Characters'], to: ['Characters']},
  {name: 'Member of', description: 'A character who belongs to a faction', symmetric: false, from: ['Characters'], to: ['Factions']},
  {name: 'Located in', description: 'A character or faction found in a place', symmetric: false, from: ['Characters', 'Factions'], to: ['Locations']},
  {name: 'Occurred in', description: 'An event that took place in a place', symmetric: false, from: ['Events'], to: ['Locations']},
];

export async function seedRelationshipTypes(client: PoolClient, worldId: string, typeIds: Record<string, string>) {
  for (const type of BUILT_IN_RELATIONSHIP_TYPES) {
    const result = await client.query(
      'INSERT INTO relationship_types (world_id, name, description, is_symmetric, from_any, to_any) VALUES ($1, $2, $3, $4, false, false) RETURNING id',
      [worldId, type.name, type.description, type.symmetric],
    );
    const id = result.rows[0].id;

    for (const name of type.from) {
      await client.query('INSERT INTO relationship_type_ends (world_id, relationship_type_id, side, entry_type_id) VALUES ($1, $2, $3, $4)', [worldId, id, 'from', typeIds[name]]);
    }

    for (const name of type.to) {
      await client.query('INSERT INTO relationship_type_ends (world_id, relationship_type_id, side, entry_type_id) VALUES ($1, $2, $3, $4)', [worldId, id, 'to', typeIds[name]]);
    }
  }
}
