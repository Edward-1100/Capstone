import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { WorldRoleGuard } from './world-role.guard';

const WORLD_ID = '11111111-1111-4111-8111-111111111111';

function createContext(request: any) {
  return {
    switchToHttp: () => ({getRequest: () => request}),
    getHandler: () => null,
  } as any;
}

function createGuard(required: string | undefined, row: any) {
  const reflector = {get: jest.fn().mockReturnValue(required)} as any;
  const db = {query: jest.fn().mockResolvedValue({rows: row ? [row] : []})} as any;

  return {guard: new WorldRoleGuard(reflector, db), db};
}

describe('WorldRoleGuard', () => {
  it('allows an owner on an owner-only route', async () => {
    const {guard} = createGuard('owner', {role: 'owner', visibility: 'private'});
    const request = {params: {id: WORLD_ID}, user: {id: 'u1'}};

    expect(await guard.canActivate(createContext(request))).toBe(true);
    expect(request).toHaveProperty('worldRole', 'owner');
  });

  it('rejects an editor on an owner-only route', async () => {
    const {guard} = createGuard('owner', {role: 'editor', visibility: 'private'});
    const request = {params: {id: WORLD_ID}, user: {id: 'u1'}};

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('rejects a viewer on an editor route', async () => {
    const {guard} = createGuard('editor', {role: 'viewer', visibility: 'private'});
    const request = {params: {id: WORLD_ID}, user: {id: 'u1'}};

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('gives a non-member viewer access to a public world', async () => {
    const {guard} = createGuard(undefined, {role: null, visibility: 'public'});
    const request = {params: {id: WORLD_ID}, user: {id: 'u2'}};

    expect(await guard.canActivate(createContext(request))).toBe(true);
    expect(request).toHaveProperty('worldRole', 'viewer');
  });

  it('gives a logged-out visitor viewer access to a public world', async () => {
    const {guard} = createGuard(undefined, {role: null, visibility: 'public'});
    const request = {params: {id: WORLD_ID}};

    expect(await guard.canActivate(createContext(request))).toBe(true);
    expect(request).toHaveProperty('worldRole', 'viewer');
  });

  it('rejects a logged-out visitor on a private world with 401', async () => {
    const {guard} = createGuard(undefined, {role: null, visibility: 'private'});
    const request = {params: {id: WORLD_ID}};

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a non-member on a private world with 404', async () => {
    const {guard} = createGuard(undefined, {role: null, visibility: 'private'});
    const request = {params: {id: WORLD_ID}, user: {id: 'u2'}};

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(NotFoundException);
  });

  it('returns 404 for a world that does not exist', async () => {
    const {guard} = createGuard(undefined, null);
    const request = {params: {id: WORLD_ID}, user: {id: 'u1'}};

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(NotFoundException);
  });

  it('returns 404 for a malformed id without querying the database', async () => {
    const {guard, db} = createGuard(undefined, null);
    const request = {params: {id: 'not-a-uuid'}, user: {id: 'u1'}};

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(NotFoundException);
    expect(db.query).not.toHaveBeenCalled();
  });
});
