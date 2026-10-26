import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  private async recent(worldId: string, action: string) {
    const result = await this.db.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (l.entry_id) l.id, l.entry_name AS name, l.created_at AS at, u.username AS by, ae.id AS "entryId"
         FROM activity_log l
         LEFT JOIN users u ON u.id = l.user_id
         LEFT JOIN active_entries ae ON ae.id = l.entry_id
         WHERE l.world_id = $1 AND l.action = $2
         ORDER BY l.entry_id, l.created_at DESC
       ) recent
       ORDER BY at DESC
       LIMIT 5`,
      [worldId, action],
    );

    return result.rows;
  }

  async get(worldId: string) {
    const count = await this.db.query('SELECT count(*)::int AS count FROM active_entries WHERE world_id = $1', [worldId]);
    const untyped = await this.db.query(
      'SELECT id, name FROM active_entries WHERE world_id = $1 AND type_id IS NULL ORDER BY updated_at DESC LIMIT 20',
      [worldId],
    );
    const recentlyCreated = await this.recent(worldId, 'created');
    const recentlyModified = await this.recent(worldId, 'updated');
    const recentlyDeleted = await this.recent(worldId, 'deleted');

    return {
      entryCount: count.rows[0].count,
      recentlyCreated,
      recentlyModified,
      recentlyDeleted,
      untyped: untyped.rows,
    };
  }
}
