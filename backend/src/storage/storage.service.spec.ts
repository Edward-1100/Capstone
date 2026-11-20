import { BadRequestException } from '@nestjs/common';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

function createService(values: Record<string, string>) {
  const config: any = {get: (name: string) => values[name], getOrThrow: (name: string) => values[name]};

  return new StorageService(config);
}

describe('StorageService local mode', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'storage-'));
  });

  afterEach(async () => {
    await rm(dir, {recursive: true, force: true});
  });

  it('is only local when STORAGE is local', () => {
    expect(createService({STORAGE: 'local'}).isLocal()).toBe(true);
    expect(createService({}).isLocal()).toBe(false);
  });

  it('stores, reads and removes files on disk', async () => {
    const service = createService({STORAGE: 'local', LOCAL_STORAGE_DIR: dir});

    await service.upload('worlds/w1/a.png', Buffer.from('hello'), 'image/png');

    expect((await service.download('worlds/w1/a.png')).toString()).toBe('hello');

    await service.remove('worlds/w1/a.png');
    await service.remove('worlds/w1/a.png');

    await expect(service.download('worlds/w1/a.png')).rejects.toThrow();
  });

  it('gives a url served by the api', async () => {
    const service = createService({STORAGE: 'local', LOCAL_STORAGE_DIR: dir});

    expect(await service.getUrl('worlds/w1/a.png')).toBe('/api/files/worlds/w1/a.png');
  });

  it('rejects keys that leave the storage folder', async () => {
    const service = createService({STORAGE: 'local', LOCAL_STORAGE_DIR: dir});

    await expect(service.upload('../outside.png', Buffer.from('x'), 'image/png')).rejects.toThrow(BadRequestException);
    expect(() => service.localFile('a/../../outside.png')).toThrow(BadRequestException);
  });
});
