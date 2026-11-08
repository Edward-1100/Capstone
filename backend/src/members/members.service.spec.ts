import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembersService } from './members.service';

function createService() {
  const db = {query: jest.fn()} as any;

  return {service: new MembersService(db), db};
}

function member(role: string, pendingRole: string | null = null) {
  return {userId: 'u2', username: 'Sam', role, pendingRole, invitedByName: 'Aria', joinedAt: 'now'};
}

describe('MembersService', () => {
  describe('invite', () => {
    it('returns not found when no user has that username', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.invite('w1', 'u1', 'Nobody', 'viewer')).rejects.toThrow(new NotFoundException('No user with that username'));
      expect(db.query.mock.calls[0][1]).toEqual(['Nobody']);
    });

    it('does not let the owner invite themselves', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'u1'}]});

      await expect(service.invite('w1', 'u1', 'Aria', 'viewer')).rejects.toThrow(new ConflictException('You are already in this world'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('refuses without saving when the user blocked the inviter', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'u2'}]}).mockResolvedValueOnce({rows: [{'?column?': 1}]});

      await expect(service.invite('w1', 'u1', 'Sam', 'editor')).rejects.toThrow(new ForbiddenException('That user can not be invited'));
      expect(db.query.mock.calls[1][1]).toEqual(['u2', 'u1']);
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('adds a viewer invite as a viewer with no pending role', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'u2'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{user_id: 'u2'}]})
        .mockResolvedValueOnce({rows: [member('viewer')]});

      expect(await service.invite('w1', 'u1', 'Sam', 'viewer')).toEqual(member('viewer'));
      expect(db.query.mock.calls[3][1]).toEqual(['w1', 'u2', null, 'u1']);
    });

    it('adds an editor invite as a viewer with a pending editor role', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'u2'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{user_id: 'u2'}]})
        .mockResolvedValueOnce({rows: [member('viewer', 'editor')]});

      expect(await service.invite('w1', 'u1', 'Sam', 'editor')).toEqual(member('viewer', 'editor'));
      expect(db.query.mock.calls[3][1]).toEqual(['w1', 'u2', 'editor', 'u1']);
    });

    it('turns an existing viewer into a pending editor invite', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'u2'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{role: 'viewer', invitedRole: null}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [member('viewer', 'editor')]});

      expect(await service.invite('w1', 'u1', 'Sam', 'editor')).toEqual(member('viewer', 'editor'));
      expect(db.query.mock.calls[3][0]).toContain('UPDATE world_members');
      expect(db.query.mock.calls[3][1]).toEqual(['w1', 'u2', 'u1']);
    });

    it('rejects someone who already has the access', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'u2'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{role: 'editor', invitedRole: null}]});

      await expect(service.invite('w1', 'u1', 'Sam', 'viewer')).rejects.toThrow(new ConflictException('That person already has access'));
    });

    it('rejects an editor invite that is already pending', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'u2'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{role: 'viewer', invitedRole: 'editor'}]});

      await expect(service.invite('w1', 'u1', 'Sam', 'editor')).rejects.toThrow(ConflictException);
    });

    it('rejects when another request added the person first', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'u2'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []});

      await expect(service.invite('w1', 'u1', 'Sam', 'viewer')).rejects.toThrow(ConflictException);
    });
  });

  describe('setRole', () => {
    it('returns not found for a missing member', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.setRole('w1', 'u2', 'editor')).rejects.toThrow(new NotFoundException('Member not found'));
    });

    it('does not change the owner', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [member('owner')]});

      await expect(service.setRole('w1', 'u1', 'viewer')).rejects.toThrow(new BadRequestException('The owner can not be changed'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('sets the role and clears a pending invite', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [member('viewer', 'editor')]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [member('editor')]});

      expect(await service.setRole('w1', 'u2', 'editor')).toEqual(member('editor'));
      expect(db.query.mock.calls[1][0]).toContain('invited_role = NULL');
      expect(db.query.mock.calls[1][1]).toEqual(['w1', 'u2', 'editor']);
    });
  });

  describe('remove', () => {
    it('returns not found for a missing member', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 'u2')).rejects.toThrow(NotFoundException);
    });

    it('does not remove the owner', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [member('owner')]});

      await expect(service.remove('w1', 'u1')).rejects.toThrow(new BadRequestException('The owner can not be removed'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('removes a member or cancels a pending invite', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [member('viewer', 'editor')]}).mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', 'u2')).toEqual({removed: true});
      expect(db.query.mock.calls[1][1]).toEqual(['w1', 'u2']);
    });
  });

  describe('leave', () => {
    it('returns not found when the user is not a member', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.leave('w1', 'u2')).rejects.toThrow(new NotFoundException('You are not a member of this world'));
    });

    it('does not let the owner leave', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [member('owner')]});

      await expect(service.leave('w1', 'u1')).rejects.toThrow(new BadRequestException('Owners can not leave their world'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('removes the member row', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [member('editor')]}).mockResolvedValueOnce({rows: []});

      expect(await service.leave('w1', 'u2')).toEqual({left: true});
      expect(db.query.mock.calls[1][0]).toContain('DELETE FROM world_members');
    });
  });

  describe('accept and deny', () => {
    it('accepts a pending invite and returns the new role', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{role: 'editor'}]});

      expect(await service.accept('w1', 'u2')).toEqual({role: 'editor'});
      expect(db.query.mock.calls[0][1]).toEqual(['w1', 'u2']);
    });

    it('returns not found when there is nothing to accept', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.accept('w1', 'u2')).rejects.toThrow(new NotFoundException('No pending invite'));
    });

    it('denies a pending invite by removing the member row', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{user_id: 'u2'}]});

      expect(await service.deny('w1', 'u2')).toEqual({denied: true});
      expect(db.query.mock.calls[0][0]).toContain('invited_role IS NOT NULL');
    });

    it('returns not found when there is nothing to deny', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.deny('w1', 'u2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('invite links', () => {
    it('lists only links that are not revoked', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'l1', token: 't', role: 'viewer'}]});

      expect(await service.listLinks('w1')).toEqual([{id: 'l1', token: 't', role: 'viewer'}]);
      expect(db.query.mock.calls[0][0]).toContain('revoked_at IS NULL');
    });

    it('stops at 20 active links', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{count: 20}]});

      await expect(service.createLink('w1', 'u1', 'viewer')).rejects.toThrow(new BadRequestException('A world can have up to 20 invite links'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('creates a link with a random url-safe token', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{count: 0}]}).mockResolvedValueOnce({rows: [{id: 'l1'}]});

      expect(await service.createLink('w1', 'u1', 'editor')).toEqual({id: 'l1'});

      const params = db.query.mock.calls[1][1];

      expect(params[0]).toBe('w1');
      expect(params[1]).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(params.slice(2)).toEqual(['editor', 'u1']);
    });

    it('revokes a link of the world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'l1'}]});

      expect(await service.revokeLink('w1', 'l1')).toEqual({revoked: true});
      expect(db.query.mock.calls[0][1]).toEqual(['l1', 'w1']);
    });

    it('returns not found when revoking a missing or already revoked link', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.revokeLink('w1', 'l1')).rejects.toThrow(new NotFoundException('Invite link not found'));
    });
  });

  describe('join', () => {
    it('returns not found for an unknown or revoked token', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.join('bad', 'u2')).rejects.toThrow(new NotFoundException('Invite link not found'));
    });

    it('refuses when the joiner blocked the link creator', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{worldId: 'w1', role: 'viewer', createdBy: 'u1'}]})
        .mockResolvedValueOnce({rows: [{'?column?': 1}]});

      await expect(service.join('t', 'u2')).rejects.toThrow(new ForbiddenException('You can not join this world'));
      expect(db.query.mock.calls[1][1]).toEqual(['u2', 'u1']);
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('adds a viewer link as a viewer', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{worldId: 'w1', role: 'viewer', createdBy: 'u1'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{user_id: 'u2'}]})
        .mockResolvedValueOnce({rows: [member('viewer')]});

      expect(await service.join('t', 'u2')).toEqual({worldId: 'w1', role: 'viewer', pendingRole: null});
    });

    it('adds an editor link as a pending editor invite', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{worldId: 'w1', role: 'editor', createdBy: 'u1'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{user_id: 'u2'}]})
        .mockResolvedValueOnce({rows: [member('viewer', 'editor')]});

      expect(await service.join('t', 'u2')).toEqual({worldId: 'w1', role: 'viewer', pendingRole: 'editor'});
      expect(db.query.mock.calls[3][1]).toEqual(['w1', 'u2', 'editor', 'u1']);
    });

    it('leaves an existing editor as they are', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{worldId: 'w1', role: 'editor', createdBy: 'u1'}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{role: 'editor', invitedRole: null}]})
        .mockResolvedValueOnce({rows: [member('editor')]});

      expect(await service.join('t', 'u2')).toEqual({worldId: 'w1', role: 'editor', pendingRole: null});
      expect(db.query).toHaveBeenCalledTimes(4);
    });

    it('skips the block check when the link creator no longer exists', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{worldId: 'w1', role: 'viewer', createdBy: null}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [{user_id: 'u2'}]})
        .mockResolvedValueOnce({rows: [member('viewer')]});

      expect(await service.join('t', 'u2')).toEqual({worldId: 'w1', role: 'viewer', pendingRole: null});
      expect(db.query.mock.calls[1][0]).toContain('SELECT role');
    });
  });
});
