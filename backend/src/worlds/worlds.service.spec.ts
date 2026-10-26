import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorldsService } from './worlds.service';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

function createService() {
  const db = {query: jest.fn()} as any;
  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    getUrl: jest.fn().mockResolvedValue('signed-url'),
  } as any;

  return {service: new WorldsService(db, storage), db, storage};
}

describe('WorldsService', () => {
  describe('remove', () => {
    it('rejects a wrong confirmation name without deleting', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{name: 'Test World', thumbnail_key: null}]});

      await expect(service.remove('w1', 'wrong')).rejects.toThrow(BadRequestException);
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    it('deletes the world when the name matches', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{name: 'Test World', thumbnail_key: null}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', 'Test World')).toEqual({deleted: true});
      expect(db.query).toHaveBeenCalledTimes(3);
    });

    it('also removes the thumbnail and entry image files', async () => {
      const {service, db, storage} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{name: 'Test World', thumbnail_key: 'worlds/w1/thumb.png'}]})
        .mockResolvedValueOnce({rows: [{storage_key: 'image-a'}, {storage_key: 'image-b'}]})
        .mockResolvedValueOnce({rows: []});

      await service.remove('w1', 'Test World');

      expect(storage.remove).toHaveBeenCalledWith('worlds/w1/thumb.png');
      expect(storage.remove).toHaveBeenCalledWith('image-a');
      expect(storage.remove).toHaveBeenCalledWith('image-b');
    });

    it('returns not found for a missing world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 'anything')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setThumbnail', () => {
    it('rejects a missing file', async () => {
      const {service} = createService();

      await expect(service.setThumbnail('w1', undefined)).rejects.toThrow(BadRequestException);
    });

    it('rejects a file that is not an image, even if named .png', async () => {
      const {service, storage} = createService();
      const file = {buffer: Buffer.from('just some text, not an image'), originalname: 'fake.png'} as any;

      await expect(service.setThumbnail('w1', file)).rejects.toThrow(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('uploads a valid PNG', async () => {
      const {service, db, storage} = createService();

      db.query.mockResolvedValue({rows: [{id: 'w1', thumbnail_key: null, thumbnailKey: null}]});

      await service.setThumbnail('w1', {buffer: PNG_BYTES} as any);

      expect(storage.upload).toHaveBeenCalledTimes(1);
      expect(storage.upload.mock.calls[0][2]).toBe('image/png');
    });
  });
});
