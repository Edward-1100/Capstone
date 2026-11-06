import { PoolClient } from 'pg';

export const BUILT_IN_RELATIONSHIP_TYPES = [
  {name: 'Friend', description: 'Two characters who are friends', from: ['Characters'], to: ['Characters']},
  {name: 'Enemy', description: 'Two characters who are enemies', from: ['Characters'], to: ['Characters']},
  {name: 'Member of', description: 'A character who belongs to a faction', from: ['Characters'], to: ['Factions']},
  {name: 'Located in', description: 'A character or faction found in a place', from: ['Characters', 'Factions'], to: ['Locations']},
  {name: 'Occurred in', description: 'An event that took place in a place', from: ['Events'], to: ['Locations']},
];

export async function seedRelationshipTypes(client: PoolClient, worldId: string, typeIds: Record<string, string>) {
  for (const type of BUILT_IN_RELATIONSHIP_TYPES) {
    const result = await client.query(
      'INSERT INTO relationship_types (world_id, name, description, from_any, to_any) VALUES ($1, $2, $3, false, false) RETURNING id',
      [worldId, type.name, type.description],
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
