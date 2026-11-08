import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BlocksService } from './blocks.service';

function createService() {
  const db = {query: jest.fn()} as any;

  return {service: new BlocksService(db), db};
}

describe('BlocksService', () => {
  it('lists the users the person blocked', async () => {
    const {service, db} = createService();

    db.query.mockResolvedValueOnce({rows: [{userId: 'u2', username: 'Sam'}]});

    expect(await service.list('u1')).toEqual([{userId: 'u2', username: 'Sam'}]);
    expect(db.query.mock.calls[0][1]).toEqual(['u1']);
  });

  it('returns not found when no user has that username', async () => {
    const {service, db} = createService();

    db.query.mockResolvedValueOnce({rows: []});

    await expect(service.add('u1', 'Nobody')).rejects.toThrow(new NotFoundException('No user with that username'));
  });

  it('does not let someone block themselves', async () => {
    const {service, db} = createService();

    db.query.mockResolvedValueOnce({rows: [{id: 'u1'}]});

    await expect(service.add('u1', 'Aria')).rejects.toThrow(new BadRequestException('You can not block yourself'));
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('blocks a user and returns the updated list', async () => {
    const {service, db} = createService();

    db.query
      .mockResolvedValueOnce({rows: [{id: 'u2'}]})
      .mockResolvedValueOnce({rows: []})
      .mockResolvedValueOnce({rows: [{userId: 'u2', username: 'Sam'}]});

    expect(await service.add('u1', ' Sam ')).toEqual([{userId: 'u2', username: 'Sam'}]);
    expect(db.query.mock.calls[0][1]).toEqual(['Sam']);
    expect(db.query.mock.calls[1][1]).toEqual(['u1', 'u2']);
    expect(db.query.mock.calls[1][0]).toContain('ON CONFLICT DO NOTHING');
  });

  it('unblocks a user and returns the updated list', async () => {
    const {service, db} = createService();

    db.query.mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: []});

    expect(await service.remove('u1', 'u2')).toEqual([]);
    expect(db.query.mock.calls[0][1]).toEqual(['u1', 'u2']);
  });
});
