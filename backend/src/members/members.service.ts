import { randomBytes } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const MAX_LINKS = 20;

const MEMBER_COLUMNS = `m.user_id AS "userId", u.username, m.role, m.invited_role AS "pendingRole",
       ib.username AS "invitedByName", m.created_at AS "joinedAt"`;

@Injectable()
export class MembersService {
  constructor(private readonly db: DatabaseService) {}

  private async grant(worldId: string, userId: string, role: string, invitedBy: string | null) {
    const existing = await this.db.query(
      'SELECT role, invited_role AS "invitedRole" FROM world_members WHERE world_id = $1 AND user_id = $2',
      [worldId, userId],
    );
    const member = existing.rows[0];

    if (!member) {
      const inserted = await this.db.query(
        `INSERT INTO world_members (world_id, user_id, role, invited_role, invited_by)
         VALUES ($1, $2, 'viewer', $3, $4)
         ON CONFLICT (world_id, user_id) DO NOTHING
         RETURNING user_id`,
        [worldId, userId, role === 'editor' ? 'editor' : null, invitedBy],
      );

      return inserted.rows.length > 0 ? 'added' : 'unchanged';
    }

    if (role === 'editor' && member.role === 'viewer' && member.invitedRole !== 'editor') {
      await this.db.query(
        `UPDATE world_members SET invited_role = 'editor', invited_by = $3 WHERE world_id = $1 AND user_id = $2`,
        [worldId, userId, invitedBy],
      );

      return 'upgraded';
    }

    return 'unchanged';
  }

  private async findMember(worldId: string, userId: string) {
    const result = await this.db.query(
      `SELECT ${MEMBER_COLUMNS}
       FROM world_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN users ib ON ib.id = m.invited_by
       WHERE m.world_id = $1 AND m.user_id = $2`,
      [worldId, userId],
    );

    return result.rows[0] ?? null;
  }

  async list(worldId: string) {
    const result = await this.db.query(
      `SELECT ${MEMBER_COLUMNS}
       FROM world_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN users ib ON ib.id = m.invited_by
       WHERE m.world_id = $1
       ORDER BY (m.role = 'owner') DESC, lower(u.username)`,
      [worldId],
    );

    return result.rows;
  }

  async invite(worldId: string, inviterId: string, username: string, role: string) {
    const found = await this.db.query('SELECT id FROM users WHERE lower(username) = lower($1)', [username.trim()]);
    const target = found.rows[0];

    if (!target) {
      throw new NotFoundException('No user with that username');
    }

    if (target.id === inviterId) {
      throw new ConflictException('You are already in this world');
    }

    const blocked = await this.db.query(
      'SELECT 1 FROM user_blocks WHERE user_id = $1 AND blocked_user_id = $2',
      [target.id, inviterId],
    );

    if (blocked.rows.length > 0) {
      throw new ForbiddenException('That user can not be invited');
    }

    const status = await this.grant(worldId, target.id, role, inviterId);

    if (status === 'unchanged') {
      throw new ConflictException('That person already has access');
    }

    return this.findMember(worldId, target.id);
  }

  async setRole(worldId: string, userId: string, role: string) {
    const member = await this.findMember(worldId, userId);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'owner') {
      throw new BadRequestException('The owner can not be changed');
    }

    await this.db.query(
      'UPDATE world_members SET role = $3, invited_role = NULL WHERE world_id = $1 AND user_id = $2',
      [worldId, userId, role],
    );

    return this.findMember(worldId, userId);
  }

  async remove(worldId: string, userId: string) {
    const member = await this.findMember(worldId, userId);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (member.role === 'owner') {
      throw new BadRequestException('The owner can not be removed');
    }

    await this.db.query('DELETE FROM world_members WHERE world_id = $1 AND user_id = $2', [worldId, userId]);

    return {removed: true};
  }

  async leave(worldId: string, userId: string) {
    const member = await this.findMember(worldId, userId);

    if (!member) {
      throw new NotFoundException('You are not a member of this world');
    }

    if (member.role === 'owner') {
      throw new BadRequestException('Owners can not leave their world');
    }

    await this.db.query('DELETE FROM world_members WHERE world_id = $1 AND user_id = $2', [worldId, userId]);

    return {left: true};
  }

  async accept(worldId: string, userId: string) {
    const result = await this.db.query(
      `UPDATE world_members SET role = invited_role, invited_role = NULL
       WHERE world_id = $1 AND user_id = $2 AND invited_role IS NOT NULL
       RETURNING role`,
      [worldId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('No pending invite');
    }

    return {role: result.rows[0].role};
  }

  async deny(worldId: string, userId: string) {
    const result = await this.db.query(
      'DELETE FROM world_members WHERE world_id = $1 AND user_id = $2 AND invited_role IS NOT NULL RETURNING user_id',
      [worldId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('No pending invite');
    }

    return {denied: true};
  }

  listLinks(worldId: string) {
    return this.db
      .query(
        `SELECT id, token, role, created_at AS "createdAt"
         FROM world_invite_links
         WHERE world_id = $1 AND revoked_at IS NULL
         ORDER BY created_at DESC`,
        [worldId],
      )
      .then((result) => result.rows);
  }

  async createLink(worldId: string, userId: string, role: string) {
    const count = await this.db.query(
      'SELECT count(*)::int AS count FROM world_invite_links WHERE world_id = $1 AND revoked_at IS NULL',
      [worldId],
    );

    if (count.rows[0].count >= MAX_LINKS) {
      throw new BadRequestException(`A world can have up to ${MAX_LINKS} invite links`);
    }

    const result = await this.db.query(
      `INSERT INTO world_invite_links (world_id, token, role, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, token, role, created_at AS "createdAt"`,
      [worldId, randomBytes(24).toString('base64url'), role, userId],
    );

    return result.rows[0];
  }

  async revokeLink(worldId: string, linkId: string) {
    const result = await this.db.query(
      'UPDATE world_invite_links SET revoked_at = now() WHERE id = $1 AND world_id = $2 AND revoked_at IS NULL RETURNING id',
      [linkId, worldId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('Invite link not found');
    }

    return {revoked: true};
  }

  async join(token: string, userId: string) {
    const found = await this.db.query(
      'SELECT world_id AS "worldId", role, created_by AS "createdBy" FROM world_invite_links WHERE token = $1 AND revoked_at IS NULL',
      [token],
    );
    const link = found.rows[0];

    if (!link) {
      throw new NotFoundException('Invite link not found');
    }

    if (link.createdBy) {
      const blocked = await this.db.query(
        'SELECT 1 FROM user_blocks WHERE user_id = $1 AND blocked_user_id = $2',
        [userId, link.createdBy],
      );

      if (blocked.rows.length > 0) {
        throw new ForbiddenException('You can not join this world');
      }
    }

    await this.grant(link.worldId, userId, link.role, link.createdBy);

    const member = await this.findMember(link.worldId, userId);

    return {worldId: link.worldId, role: member.role, pendingRole: member.pendingRole};
  }
}
