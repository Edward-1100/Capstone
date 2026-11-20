import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { canReviewSuggestions, canSubmitSuggestion, DashboardSettings, readSettings } from './dashboard.settings';
import { DETAIL_SLOTS, DashboardSettingsDto, ItemChangeDto, NewItemDto } from './dto/dashboard.dto';

export const MAX_FEATURED = 12;
export const MAX_PINNED = 20;
export const MAX_OPEN_SUGGESTIONS = 12;
const LIST_LIMIT = 100;

@Injectable()
export class DashboardItemsService {
  constructor(private readonly db: DatabaseService) {}

  private async activeEntry(worldId: string, entryId: string) {
    const result = await this.db.query('SELECT id, name, type_id AS "typeId" FROM active_entries WHERE id = $1 AND world_id = $2', [entryId, worldId]);

    if (!result.rows[0]) {
      throw new NotFoundException('Entry not found');
    }

    return result.rows[0];
  }

  private async loadSettings(worldId: string): Promise<DashboardSettings> {
    const result = await this.db.query('SELECT dashboard_settings AS "settings" FROM worlds WHERE id = $1', [worldId]);

    return readSettings(result.rows[0]?.settings);
  }

  async getSettings(worldId: string) {
    const result = await this.db.query('SELECT announcement, dashboard_settings AS "settings" FROM worlds WHERE id = $1', [worldId]);

    return {announcement: result.rows[0].announcement, settings: readSettings(result.rows[0].settings)};
  }

  async updateSettings(worldId: string, dto: DashboardSettingsDto) {
    const current = await this.getSettings(worldId);
    const changes: Record<string, any> = dto.settings ?? {};
    const merged: Record<string, any> = {};

    for (const key of Object.keys(current.settings)) {
      merged[key] = Object.assign({}, (current.settings as any)[key], typeof changes[key] === 'object' && changes[key] !== null ? changes[key] : {});
    }

    const settings = readSettings(merged);
    const announcement = dto.announcement === undefined ? current.announcement : dto.announcement.trim();

    await this.db.query('UPDATE worlds SET dashboard_settings = $2::jsonb, announcement = $3 WHERE id = $1', [worldId, JSON.stringify(settings), announcement]);

    return {announcement, settings};
  }

  private async checkTarget(worldId: string, dto: NewItemDto) {
    const kind = dto.kind ?? 'entry';

    if (kind === 'relationship') {
      if (!dto.relationshipId) {
        throw new BadRequestException('Relationship is required');
      }

      const found = await this.db.query(
        `SELECT r.id FROM relationships r
         JOIN active_entries f ON f.id = r.from_entry_id
         JOIN active_entries t ON t.id = r.to_entry_id
         WHERE r.id = $1 AND r.world_id = $2`,
        [dto.relationshipId, worldId],
      );

      if (!found.rows[0]) {
        throw new NotFoundException('Relationship not found');
      }

      return {kind, entryId: null, relationshipId: dto.relationshipId, fieldIds: []};
    }

    if (!dto.entryId) {
      throw new BadRequestException('Entry is required');
    }

    const entry = await this.activeEntry(worldId, dto.entryId);

    if (kind === 'entry') {
      return {kind, entryId: entry.id, relationshipId: null, fieldIds: []};
    }

    const wanted = Array.from(new Set(dto.fieldIds ?? []));

    if (wanted.length === 0) {
      throw new BadRequestException('Choose at least one detail');
    }

    const fields = await this.db.query('SELECT id, field_type AS "fieldType" FROM type_fields WHERE type_id = $1 AND id = ANY($2::uuid[])', [entry.typeId, wanted]);

    if (fields.rows.length !== wanted.length) {
      throw new BadRequestException('Those details are not on this entry');
    }

    const spaces = fields.rows.reduce((total: number, field: any) => total + (field.fieldType === 'long_text' ? 2 : 1), 0);

    if (spaces > DETAIL_SLOTS) {
      throw new BadRequestException(`Details can fill up to ${DETAIL_SLOTS} spaces and long text fills 2`);
    }

    return {kind, entryId: entry.id, relationshipId: null, fieldIds: wanted};
  }

  private async insertItem(table: string, max: number, noun: string, worldId: string, userId: string, dto: NewItemDto) {
    const target = await this.checkTarget(worldId, dto);
    const pinned = table === 'pinned_entries';
    const note = pinned && target.kind === 'entry' ? await this.checkNote(worldId, target.entryId as string, dto.noteId) : null;
    const count = await this.db.query(`SELECT count(*)::int AS count FROM ${table} WHERE world_id = $1`, [worldId]);

    if (count.rows[0].count >= max) {
      throw new BadRequestException(`Up to ${max} items can be ${noun}`);
    }

    const values: any[] = [worldId, userId, target.kind, target.entryId, target.relationshipId, JSON.stringify(target.fieldIds), dto.layout ?? 'image', (dto.message ?? '').trim()];

    if (pinned) {
      values.push(note);
    }

    const result = await this.db.query(
      `INSERT INTO ${table} (world_id, added_by, kind, entry_id, relationship_id, field_ids, layout, message${pinned ? ', note_id' : ''})
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8${pinned ? ', $9' : ''})
       ON CONFLICT DO NOTHING
       RETURNING id`,
      values,
    );

    return {id: result.rows[0] ? result.rows[0].id : null};
  }

  addFeatured(worldId: string, userId: string, dto: NewItemDto) {
    return this.insertItem('featured_entries', MAX_FEATURED, 'featured', worldId, userId, dto);
  }

  addPinned(worldId: string, userId: string, dto: NewItemDto) {
    return this.insertItem('pinned_entries', MAX_PINNED, 'pinned', worldId, userId, dto);
  }

  async changeFeatured(worldId: string, itemId: string, dto: ItemChangeDto) {
    const result = await this.db.query(
      'UPDATE featured_entries SET layout = COALESCE($3, layout), message = COALESCE($4, message) WHERE id = $1 AND world_id = $2 RETURNING id',
      [itemId, worldId, dto.layout ?? null, dto.message === undefined ? null : dto.message.trim()],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Featured item not found');
    }

    return {id: itemId};
  }

  async changePinned(worldId: string, itemId: string, dto: ItemChangeDto) {
    const found = await this.db.query('SELECT entry_id AS "entryId", kind FROM pinned_entries WHERE id = $1 AND world_id = $2', [itemId, worldId]);

    if (!found.rows[0]) {
      throw new NotFoundException('Pinned item not found');
    }

    const setNote = dto.noteId !== undefined;

    if (setNote && found.rows[0].kind !== 'entry') {
      throw new BadRequestException('Only an entry can have a note');
    }

    const note = setNote ? await this.checkNote(worldId, found.rows[0].entryId, dto.noteId) : null;

    await this.db.query(
      `UPDATE pinned_entries
       SET layout = COALESCE($3, layout), message = COALESCE($4, message), note_id = CASE WHEN $5::boolean THEN $6::uuid ELSE note_id END
       WHERE id = $1 AND world_id = $2`,
      [itemId, worldId, dto.layout ?? null, dto.message === undefined ? null : dto.message.trim(), setNote, note],
    );

    return {id: itemId};
  }

  async removeFeatured(worldId: string, itemId: string) {
    await this.db.query('DELETE FROM featured_entries WHERE id = $1 AND world_id = $2', [itemId, worldId]);

    return {id: itemId};
  }

  async removePinned(worldId: string, itemId: string) {
    await this.db.query('DELETE FROM pinned_entries WHERE id = $1 AND world_id = $2', [itemId, worldId]);

    return {id: itemId};
  }

  private async checkNote(worldId: string, entryId: string, noteId: string | null | undefined) {
    if (!noteId) {
      return null;
    }

    const result = await this.db.query('SELECT id FROM notes WHERE id = $1 AND entry_id = $2 AND world_id = $3', [noteId, entryId, worldId]);

    if (!result.rows[0]) {
      throw new BadRequestException('That note is not on this entry');
    }

    return noteId;
  }

  async createSuggestion(worldId: string, userId: string, role: string, body: string, entryId?: string, anonymous?: boolean) {
    const settings = await this.loadSettings(worldId);

    if (!canSubmitSuggestion(settings, role)) {
      throw new ForbiddenException('Suggestions are not open to you in this world');
    }

    const entry = entryId ? await this.activeEntry(worldId, entryId) : null;
    const open = await this.db.query(`SELECT count(*)::int AS count FROM suggestions WHERE world_id = $1 AND user_id = $2 AND status = 'open'`, [worldId, userId]);

    if (open.rows[0].count >= MAX_OPEN_SUGGESTIONS) {
      throw new BadRequestException(`You already have ${MAX_OPEN_SUGGESTIONS} open suggestions in this world`);
    }

    const result = await this.db.query(
      'INSERT INTO suggestions (world_id, user_id, entry_id, entry_name, body, anonymous) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [worldId, userId, entry ? entry.id : null, entry ? entry.name : null, body.trim(), anonymous === true],
    );

    return {id: result.rows[0].id};
  }

  private async assertReviewer(worldId: string, role: string) {
    const settings = await this.loadSettings(worldId);

    if (!canReviewSuggestions(settings, role)) {
      throw new ForbiddenException('Insufficient permission');
    }
  }

  async listSuggestions(worldId: string, role: string, closed: boolean) {
    await this.assertReviewer(worldId, role);

    const result = await this.db.query(
      `SELECT s.id, s.body, s.status, s.anonymous, s.created_at AS "createdAt", s.resolved_at AS "resolvedAt",
              s.entry_name AS "entryName", ae.id AS "entryId",
              CASE WHEN s.anonymous THEN NULL ELSE u.username END AS "authorName",
              r.username AS "resolvedBy"
       FROM suggestions s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN users r ON r.id = s.resolved_by
       LEFT JOIN active_entries ae ON ae.id = s.entry_id
       WHERE s.world_id = $1 AND (s.status = 'open') <> $2
       ORDER BY s.created_at DESC
       LIMIT ${LIST_LIMIT}`,
      [worldId, closed],
    );

    return result.rows;
  }

  async setSuggestionStatus(worldId: string, role: string, userId: string, suggestionId: string, status: string) {
    await this.assertReviewer(worldId, role);

    const result = await this.db.query(
      `UPDATE suggestions
       SET status = $3, resolved_by = CASE WHEN $3 = 'open' THEN NULL ELSE $4::uuid END, resolved_at = CASE WHEN $3 = 'open' THEN NULL ELSE now() END
       WHERE id = $1 AND world_id = $2
       RETURNING id, status`,
      [suggestionId, worldId, status, userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Suggestion not found');
    }

    return result.rows[0];
  }
}
