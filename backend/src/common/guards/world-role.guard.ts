import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import { DatabaseService } from '../../database/database.service';
import { WORLD_ROLE_KEY, WorldRoleName } from '../decorators/world-role.decorator';

const RANK: Record<string, number> = {viewer: 1, editor: 2, owner: 3};

@Injectable()
export class WorldRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const required = this.reflector.get<WorldRoleName>(WORLD_ROLE_KEY, context.getHandler()) ?? 'viewer';
    const worldId = request.params.id;
    const userId = request.user?.id ?? null;

    let role: string | null = null;

    if (isUUID(worldId)) {
      const result = await this.db.query(
        `SELECT w.visibility, m.role
         FROM worlds w
         LEFT JOIN world_members m ON m.world_id = w.id AND m.user_id = $2
         WHERE w.id = $1`,
        [worldId, userId],
      );
      const row = result.rows[0];

      if (row) {
        role = row.role ?? (row.visibility === 'public' ? 'viewer' : null);
      }
    }

    if (!role) {
      throw userId ? new NotFoundException('World not found') : new UnauthorizedException();
    }

    if (RANK[role] < RANK[required]) {
      throw new ForbiddenException('Insufficient permission');
    }

    request.worldRole = role;

    return true;
  }
}
