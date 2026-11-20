import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';

@Controller('files')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get('*key')
  get(@Param('key') key: string | string[], @Res() res: Response) {
    if (!this.storage.isLocal()) {
      throw new NotFoundException('File not found');
    }

    const name = Array.isArray(key) ? key.join('/') : key;

    res.setHeader('Cache-Control', 'private, max-age=21600');
    res.sendFile(this.storage.localFile(name), (err) => {
      if (err && !res.headersSent) {
        res.status(404).end();
      }
    });
  }
}
