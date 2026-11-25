import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateTimelineEntryDto } from './dto/create-timeline-entry.dto';
import { TimelineColorDto } from './dto/timeline-color.dto';
import { UpdateTimelineEntryDto } from './dto/update-timeline-entry.dto';
import { datesProblem, normalizeDates } from './timeline-dates';

function checkedDates(input: any) {
  const dates = normalizeDates(input);
  const problem = datesProblem(dates);

  if (problem) {
    throw new BadRequestException(problem);
  }

  return dates;
}

@Injectable()
export class TimelineService {
  constructor(private readonly db: DatabaseService) {}

  private async load(worldId: string, itemId: string | null) {
    const result = await this.db.query(
      `SELECT k.id, k.entry_id AS "entryId", e.name AS "entryName", t.name AS "typeName",
       k.start_year AS "startYear", k.start_month AS "startMonth", k.start_day AS "startDay",
       k.start_hour AS "startHour", k.start_minute AS "startMinute",
       k.end_year AS "endYear", k.end_month AS "endMonth", k.end_day AS "endDay",
       k.end_hour AS "endHour", k.end_minute AS "endMinute", k.color
       FROM timeline_entries k
       JOIN active_entries e ON e.id = k.entry_id AND e.world_id = k.world_id
       JOIN entry_types t ON t.id = e.type_id AND t.timelineable
       WHERE k.world_id = $1
       AND ($2::uuid IS NULL OR k.id = $2::uuid)
       ORDER BY k.start_year, COALESCE(k.start_month, 1), COALESCE(k.start_day, 1),
       COALESCE(k.start_hour, 0), COALESCE(k.start_minute, 0), lower(e.name)`,
      [worldId, itemId],
    );

    return result.rows;
  }

  list(worldId: string) {
    return this.load(worldId, null);
  }

  async create(worldId: string, userId: string, dto: CreateTimelineEntryDto) {
    const dates = checkedDates(dto);

    const found = await this.db.query(
      `SELECT e.type_id AS "typeId", t.timelineable
       FROM active_entries e
       LEFT JOIN entry_types t ON t.id = e.type_id
       WHERE e.id = $1 AND e.world_id = $2`,
      [dto.entryId, worldId],
    );
    const entry = found.rows[0];

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }

    if (!entry.typeId) {
      throw new BadRequestException('Entries without a type can not be placed on the timeline');
    }

    if (!entry.timelineable) {
      throw new BadRequestException('Entries of this type can not be placed on the timeline');
    }

    try {
      const created = await this.db.query(
        `INSERT INTO timeline_entries (world_id, entry_id, start_year, start_month, start_day, start_hour, start_minute, end_year, end_month, end_day, end_hour, end_minute, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [worldId, dto.entryId, dates.startYear, dates.startMonth, dates.startDay, dates.startHour, dates.startMinute, dates.endYear, dates.endMonth, dates.endDay, dates.endHour, dates.endMinute, userId],
      );
      const items = await this.load(worldId, created.rows[0].id);

      return items[0];
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException('Entry already exists on timeline');
      }

      throw err;
    }
  }

  async update(worldId: string, itemId: string, dto: UpdateTimelineEntryDto) {
    const current = await this.load(worldId, itemId);

    if (!current[0]) {
      throw new NotFoundException('Timeline entry not found');
    }

    const dates = checkedDates(dto);

    await this.db.query(
      `UPDATE timeline_entries
       SET start_year = $3, start_month = $4, start_day = $5, start_hour = $6, start_minute = $7,
       end_year = $8, end_month = $9, end_day = $10, end_hour = $11, end_minute = $12, updated_at = now()
       WHERE id = $1 AND world_id = $2`,
      [itemId, worldId, dates.startYear, dates.startMonth, dates.startDay, dates.startHour, dates.startMinute, dates.endYear, dates.endMonth, dates.endDay, dates.endHour, dates.endMinute],
    );

    const items = await this.load(worldId, itemId);

    return items[0];
  }

  async setColor(worldId: string, itemId: string, dto: TimelineColorDto) {
    const result = await this.db.query(
      'UPDATE timeline_entries SET color = $3, updated_at = now() WHERE id = $1 AND world_id = $2 RETURNING id',
      [itemId, worldId, dto.color ?? null],
    );

    if (!result.rows[0]) {
      throw new NotFoundException('Timeline entry not found');
    }

    const items = await this.load(worldId, itemId);

    return items[0];
  }

  async remove(worldId: string, itemId: string) {
    const result = await this.db.query('DELETE FROM timeline_entries WHERE id = $1 AND world_id = $2 RETURNING id', [itemId, worldId]);

    if (!result.rows[0]) {
      throw new NotFoundException('Timeline entry not found');
    }

    return {deleted: true};
  }
}
