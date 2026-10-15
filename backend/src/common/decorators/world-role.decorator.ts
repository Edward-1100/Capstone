import { SetMetadata } from '@nestjs/common';

export type WorldRoleName = 'viewer' | 'editor' | 'owner';
export const WORLD_ROLE_KEY = 'worldRole';
export const WorldRole = (role: WorldRoleName) => SetMetadata(WORLD_ROLE_KEY, role);

