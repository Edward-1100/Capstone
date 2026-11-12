import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MapsService } from './maps.service';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

function createService() {
  const client = {query: jest.fn()};
  const db = {query: jest.fn(), transaction: jest.fn((fn: any) => fn(client))} as any;
  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    getUrl: jest.fn((key: string) => Promise.resolve(`url:${key}`)),
  } as any;

  return {service: new MapsService(db, storage), db, client, storage};
}

function file(buffer: Buffer = PNG_BYTES) {
  return {buffer} as Express.Multer.File;
}

function markerRow(overrides: Record<string, any> = {}) {
  return Object.assign({id: 'k1', mapId: 'm1', entryId: 'e1', entryName: 'Aria', typeName: 'Characters', x: 0.25, y: 0.5, color: '#d93025', innerColor: '#ffffff', imageScale: 1, imageX: 0, imageY: 0, imageId: null, imageKey: null}, overrides);
}

function duplicateError() {
  return Object.assign(new Error('duplicate'), {code: '23505'});
}

describe('MapsService', () => {
  describe('list', () => {
    it('returns the maps with the limit of the world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'm1', name: 'World', markerCount: 2}]}).mockResolvedValueOnce({rows: [{maxMaps: 6}]});

      expect(await service.list('w1')).toEqual({maps: [{id: 'm1', name: 'World', markerCount: 2}], maxMaps: 6});
      expect(db.query.mock.calls[0][0]).toContain('t.mappable');
    });
  });

  describe('findOne', () => {
    it('returns not found for a map in another world', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.findOne('w1', 'm1')).rejects.toThrow(new NotFoundException('Map not found'));
      expect(db.query.mock.calls[0][1]).toEqual(['m1', 'w1']);
    });

    it('returns signed urls for the map and for each marker image', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{id: 'm1', name: 'World', storageKey: 'maps/a.png'}]})
        .mockResolvedValueOnce({rows: [markerRow({imageKey: 'entries/b.png'}), markerRow({id: 'k2', entryId: 'e2', entryName: 'Bram'})]});

      const map = await service.findOne('w1', 'm1');

      expect(map.imageUrl).toBe('url:maps/a.png');
      expect(map.markers.map((marker: any) => marker.imageUrl)).toEqual(['url:entries/b.png', null]);
      expect(map.markers[0]).not.toHaveProperty('imageKey');
      expect(db.query.mock.calls[1][1]).toEqual(['w1', 'm1', null]);
    });

    it('only loads markers whose entry is active and of a mappable type', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'm1', name: 'World', storageKey: 'maps/a.png'}]}).mockResolvedValueOnce({rows: []});

      await service.findOne('w1', 'm1');

      expect(db.query.mock.calls[1][0]).toContain('active_entries');
      expect(db.query.mock.calls[1][0]).toContain('t.mappable');
    });
  });

  describe('create', () => {
    it('requires a file', async () => {
      const {service} = createService();

      await expect(service.create('w1', 'u1', 'World', undefined)).rejects.toThrow(new BadRequestException('File is required'));
    });

    it('rejects a file that is not a PNG, JPEG, or WebP image', async () => {
      const {service, storage} = createService();

      await expect(service.create('w1', 'u1', 'World', file(Buffer.from('<svg></svg>')))).rejects.toThrow(new BadRequestException('File must be PNG, JPEG, or WebP'));
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('refuses when the world has reached its limit', async () => {
      const {service, client, storage} = createService();

      client.query.mockResolvedValueOnce({rows: [{maxMaps: 6}]}).mockResolvedValueOnce({rows: [{count: 6}]});

      await expect(service.create('w1', 'u1', 'World', file())).rejects.toThrow(new BadRequestException('A world can have up to 6 maps'));
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('uses the singular when the limit is one', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{maxMaps: 1}]}).mockResolvedValueOnce({rows: [{count: 1}]});

      await expect(service.create('w1', 'u1', 'World', file())).rejects.toThrow('A world can have up to 1 map');
    });

    it('locks the world row so two requests can not pass the limit together', async () => {
      const {service, client} = createService();

      client.query.mockResolvedValueOnce({rows: [{maxMaps: 6}]}).mockResolvedValueOnce({rows: [{count: 6}]});

      await service.create('w1', 'u1', 'World', file()).catch(() => null);

      expect(client.query.mock.calls[0][0]).toContain('FOR UPDATE');
    });

    it('uploads the image and saves the map', async () => {
      const {service, client, db, storage} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{maxMaps: 6}]})
        .mockResolvedValueOnce({rows: [{count: 5}]})
        .mockResolvedValueOnce({rows: [{id: 'm1'}]});
      db.query.mockResolvedValueOnce({rows: [{id: 'm1', name: 'World', storageKey: 'k'}]}).mockResolvedValueOnce({rows: []});

      const map = await service.create('w1', 'u1', ' World ', file());

      const key = storage.upload.mock.calls[0][0];

      expect(key).toMatch(/^worlds\/w1\/maps\/[0-9a-f-]{36}\.png$/);
      expect(storage.upload.mock.calls[0][2]).toBe('image/png');
      expect(client.query.mock.calls[2][1]).toEqual(['w1', 'World', key, 'u1']);
      expect(map.id).toBe('m1');
    });

    it('removes the uploaded image when saving fails', async () => {
      const {service, client, storage} = createService();

      client.query
        .mockResolvedValueOnce({rows: [{maxMaps: 6}]})
        .mockResolvedValueOnce({rows: [{count: 0}]})
        .mockRejectedValueOnce(new Error('boom'));

      await expect(service.create('w1', 'u1', 'World', file())).rejects.toThrow('boom');
      expect(storage.remove).toHaveBeenCalledWith(storage.upload.mock.calls[0][0]);
    });
  });

  describe('rename', () => {
    it('renames the map', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'm1', name: 'Old world'}]});

      expect(await service.rename('w1', 'm1', ' Old world ')).toEqual({id: 'm1', name: 'Old world'});
      expect(db.query.mock.calls[0][1]).toEqual(['m1', 'w1', 'Old world']);
    });

    it('returns not found for a missing map', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.rename('w1', 'm1', 'Old world')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('returns not found for a missing map', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.remove('w1', 'm1', 'World')).rejects.toThrow(new NotFoundException('Map not found'));
    });

    it('requires the map name to be typed', async () => {
      const {service, db, storage} = createService();

      db.query.mockResolvedValueOnce({rows: [{name: 'World', storageKey: 'k'}]});

      await expect(service.remove('w1', 'm1', 'world')).rejects.toThrow(new BadRequestException('Confirmation does not match map name'));
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(storage.remove).not.toHaveBeenCalled();
    });

    it('deletes the map and its image', async () => {
      const {service, db, storage} = createService();

      db.query.mockResolvedValueOnce({rows: [{name: 'World', storageKey: 'k'}]}).mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', 'm1', 'World')).toEqual({deleted: true});
      expect(storage.remove).toHaveBeenCalledWith('k');
    });

    it('still deletes the map when removing the image fails', async () => {
      const {service, db, storage} = createService();

      storage.remove.mockRejectedValue(new Error('offline'));
      db.query.mockResolvedValueOnce({rows: [{name: 'World', storageKey: 'k'}]}).mockResolvedValueOnce({rows: []});

      expect(await service.remove('w1', 'm1', 'World')).toEqual({deleted: true});
    });
  });

  describe('createMarker', () => {
    const dto = {entryId: 'e1', x: 0.25, y: 0.5};

    it('returns not found for a missing map', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.createMarker('w1', 'm1', 'u1', dto)).rejects.toThrow(new NotFoundException('Map not found'));
    });

    it('returns not found for a missing or deleted entry', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{}]}).mockResolvedValueOnce({rows: []});

      await expect(service.createMarker('w1', 'm1', 'u1', dto)).rejects.toThrow(new NotFoundException('Entry not found'));
    });

    it('rejects an entry without a type', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{}]}).mockResolvedValueOnce({rows: [{typeId: null, mappable: null}]});

      await expect(service.createMarker('w1', 'm1', 'u1', dto)).rejects.toThrow(new BadRequestException('Entries without a type can not be placed on a map'));
    });

    it('rejects an entry whose type can not be placed on a map', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{}]}).mockResolvedValueOnce({rows: [{typeId: 't1', mappable: false}]});

      await expect(service.createMarker('w1', 'm1', 'u1', dto)).rejects.toThrow(new BadRequestException('Entries of this type can not be placed on a map'));
    });

    it('rejects an image that belongs to another entry', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{}]}).mockResolvedValueOnce({rows: [{typeId: 't1', mappable: true}]}).mockResolvedValueOnce({rows: []});

      await expect(service.createMarker('w1', 'm1', 'u1', Object.assign({imageId: 'i9'}, dto))).rejects.toThrow(new NotFoundException('Image not found'));
      expect(db.query.mock.calls[2][1]).toEqual(['i9', 'e1']);
    });

    it('reports an entry that is already on the map', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{}]}).mockResolvedValueOnce({rows: [{typeId: 't1', mappable: true}]}).mockRejectedValueOnce(duplicateError());

      await expect(service.createMarker('w1', 'm1', 'u1', dto)).rejects.toThrow(new ConflictException('That entry is already on this map'));
    });

    it('places the marker with the default color and image', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{}]})
        .mockResolvedValueOnce({rows: [{typeId: 't1', mappable: true}]})
        .mockResolvedValueOnce({rows: [{id: 'k1'}]})
        .mockResolvedValueOnce({rows: [markerRow()]});

      expect((await service.createMarker('w1', 'm1', 'u1', dto)).id).toBe('k1');
      expect(db.query.mock.calls[2][1]).toEqual(['m1', 'w1', 'e1', null, '#d93025', 0.25, 0.5, 'u1']);
      expect(db.query.mock.calls[3][1]).toEqual(['w1', null, 'k1']);
    });

    it('places the marker with a chosen color and image', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [{}]})
        .mockResolvedValueOnce({rows: [{typeId: 't1', mappable: true}]})
        .mockResolvedValueOnce({rows: [{'?column?': 1}]})
        .mockResolvedValueOnce({rows: [{id: 'k1'}]})
        .mockResolvedValueOnce({rows: [markerRow()]});

      await service.createMarker('w1', 'm1', 'u1', Object.assign({color: '#416600', imageId: 'i1'}, dto));

      expect(db.query.mock.calls[3][1]).toEqual(['m1', 'w1', 'e1', 'i1', '#416600', 0.25, 0.5, 'u1']);
    });

    it('passes other errors on', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{}]}).mockResolvedValueOnce({rows: [{typeId: 't1', mappable: true}]}).mockRejectedValueOnce(new Error('boom'));

      await expect(service.createMarker('w1', 'm1', 'u1', dto)).rejects.toThrow('boom');
    });
  });

  describe('updateMarker', () => {
    it('returns not found for a missing or hidden marker', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.updateMarker('w1', 'k1', {x: 0.1})).rejects.toThrow(new NotFoundException('Marker not found'));
    });

    it('moves the marker and leaves the rest alone', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [markerRow()]}).mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: [markerRow({x: 0.1})]});

      expect((await service.updateMarker('w1', 'k1', {x: 0.1, y: 0.9})).x).toBe(0.1);
      expect(db.query.mock.calls[1][1]).toEqual(['k1', 'w1', 0.1, 0.9, null, false, null, null, null, null, null]);
    });

    it('changes the color only', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [markerRow()]}).mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: [markerRow()]});

      await service.updateMarker('w1', 'k1', {color: '#416600'});

      expect(db.query.mock.calls[1][1]).toEqual(['k1', 'w1', null, null, '#416600', false, null, null, null, null, null]);
    });

    it('goes back to the first image of the entry when the image is set to null', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [markerRow({imageId: 'i1'})]}).mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: [markerRow()]});

      await service.updateMarker('w1', 'k1', {imageId: null});

      expect(db.query.mock.calls[1][1]).toEqual(['k1', 'w1', null, null, null, true, null, null, null, null, null]);
      expect(db.query).toHaveBeenCalledTimes(3);
    });

    it('saves the inner color and the image scale and position', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [markerRow()]}).mockResolvedValueOnce({rows: []}).mockResolvedValueOnce({rows: [markerRow({innerColor: '#112233', imageScale: 2, imageX: 0.25, imageY: -0.5})]});

      const result = await service.updateMarker('w1', 'k1', {innerColor: '#112233', imageScale: 2, imageX: 0.25, imageY: -0.5});

      expect(db.query.mock.calls[1][1]).toEqual(['k1', 'w1', null, null, null, false, null, '#112233', 2, 0.25, -0.5]);
      expect(result).toMatchObject({innerColor: '#112233', imageScale: 2, imageX: 0.25, imageY: -0.5});
    });

    it('checks that a chosen image belongs to the entry of the marker', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [markerRow()]}).mockResolvedValueOnce({rows: []});

      await expect(service.updateMarker('w1', 'k1', {imageId: 'i9'})).rejects.toThrow(new NotFoundException('Image not found'));
      expect(db.query.mock.calls[1][1]).toEqual(['i9', 'e1']);
    });

    it('saves a chosen image', async () => {
      const {service, db} = createService();

      db.query
        .mockResolvedValueOnce({rows: [markerRow()]})
        .mockResolvedValueOnce({rows: [{'?column?': 1}]})
        .mockResolvedValueOnce({rows: []})
        .mockResolvedValueOnce({rows: [markerRow({imageId: 'i1'})]});

      await service.updateMarker('w1', 'k1', {imageId: 'i1'});

      expect(db.query.mock.calls[2][1]).toEqual(['k1', 'w1', null, null, null, true, 'i1', null, null, null, null]);
    });
  });

  describe('removeMarker', () => {
    it('deletes the marker', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: [{id: 'k1'}]});

      expect(await service.removeMarker('w1', 'k1')).toEqual({deleted: true});
      expect(db.query.mock.calls[0][1]).toEqual(['k1', 'w1']);
    });

    it('returns not found for a missing marker', async () => {
      const {service, db} = createService();

      db.query.mockResolvedValueOnce({rows: []});

      await expect(service.removeMarker('w1', 'k1')).rejects.toThrow(new NotFoundException('Marker not found'));
    });
  });
});
