import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';

function createService() {
  const db = {query: jest.fn()} as any;

  return {service: new NotesService(db), db};
}

function note(authorId: string | null) {
  return {id: 'c1', body: 'Hello', authorId, authorName: 'Aria', edited: false};
}

describe('NotesService', () => {
  describe('list', () => {
    it('returns not found when the entry is missing or deleted', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.list('w1', 'e1')).rejects.toThrow(new NotFoundException('Entry not found'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('lists the notes of the entry newest first', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'e1'}]}).mockResolvedValueOnce({rows: [note('u1')]});

      expect(await service.list('w1', 'e1')).toEqual([note('u1')]);
      expect(db.query.mock.calls[1][1]).toEqual(['e1', 'w1']);
      expect(db.query.mock.calls[1][0]).toContain('ORDER BY n.created_at DESC');
    });
  });

  describe('create', () => {
    it('returns not found without saving when the entry is missing', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.create('w1', 'e1', 'u1', {body: 'Hi'})).rejects.toThrow(NotFoundException);
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('saves the text trimmed with its author and returns the new note', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'e1'}]})
        .mockResolvedValueOnce({rows: [{id: 'c1'}]})
        .mockResolvedValueOnce({rows: [note('u1')]});

      expect(await service.create('w1', 'e1', 'u1', {body: '  Hello  '})).toEqual(note('u1'));
      expect(db.query.mock.calls[1][1]).toEqual(['w1', 'e1', 'u1', 'Hello']);
    });
  });

  describe('update', () => {
    it('returns not found for a missing note', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.update('w1', 'c1', 'u1', {body: 'New'})).rejects.toThrow(new NotFoundException('Note not found'));
    });

    it('does not let someone edit another person\'s note', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [note('u2')]});

      await expect(service.update('w1', 'c1', 'u1', {body: 'New'})).rejects.toThrow(new ForbiddenException('You can only edit your own notes'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('lets the author save the text trimmed', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [note('u1')]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [Object.assign({}, note('u1'), {body: 'New', edited: true})]});

      const result = await service.update('w1', 'c1', 'u1', {body: ' New '});

      expect(db.query.mock.calls[1][1]).toEqual(['c1', 'w1', 'New']);
      expect(result.edited).toBe(true);
    });
  });

  describe('remove', () => {
    it('returns not found for a missing note', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 'c1', 'u1', 'editor')).rejects.toThrow(NotFoundException);
    });

    it('does not let an editor delete another person\'s note', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [note('u2')]});

      await expect(service.remove('w1', 'c1', 'u1', 'editor')).rejects.toThrow(new ForbiddenException('You can only delete your own notes'));
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('lets an editor delete their own note', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [note('u1')]}).mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', 'c1', 'u1', 'editor')).toEqual({deleted: true});
      expect(db.query.mock.calls[1][1]).toEqual(['c1', 'w1']);
    });

    it('lets the owner delete another person\'s note', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [note('u2')]}).mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', 'c1', 'u1', 'owner')).toEqual({deleted: true});
    });

    it('lets only the owner delete a note whose author is gone', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [note(null)]});

      await expect(service.remove('w1', 'c1', 'u1', 'editor')).rejects.toThrow(ForbiddenException);

      db.query.mockResolvedValueOnce({rows: [note(null)]}).mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', 'c1', 'u1', 'owner')).toEqual({deleted: true});
    });
  });
});
