import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, resolve, sep } from 'path';

//Milisecons
const SIGNING = 6 * 60 * 60 * 1000;
//Seconds
const URL_LIFETIME = 12 * 60 * 60;
const CACHE = 6 * 60 * 60;

@Injectable()
export class StorageService {
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  isLocal() {
    return this.config.get<string>('STORAGE') === 'local';
  }

  localFile(key: string) {
    const root = resolve(this.config.get<string>('LOCAL_STORAGE_DIR') ?? 'uploads');
    const file = resolve(root, key);

    if (!file.startsWith(root + sep)) {
      throw new BadRequestException('File path is not valid');
    }

    return file;
  }

  private getClient() {
    if (!this.client) {
      this.client = new S3Client({
        region: this.config.getOrThrow<string>('B2_REGION'),
        endpoint: this.config.getOrThrow<string>('B2_ENDPOINT'),
        credentials: {
          accessKeyId: this.config.getOrThrow<string>('B2_KEY_ID'),
          secretAccessKey: this.config.getOrThrow<string>('B2_APPLICATION_KEY'),
        },
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    }

    return this.client;
  }

  async upload(key: string, body: Buffer, contentType: string) {

    if (this.isLocal()) {
      const file = this.localFile(key);

      await mkdir(dirname(file), {recursive: true});
      await writeFile(file, body);

      return;
    }

    const command = new PutObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET'),
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.getClient().send(command);
  }

  async remove(key: string) {

    if (this.isLocal()) {
      await rm(this.localFile(key), {force: true});

      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET'),
      Key: key,
    });

    await this.getClient().send(command);
  }

  async download(key: string) {

    if (this.isLocal()) {
      return readFile(this.localFile(key));
    }

    const command = new GetObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET'),
      Key: key,
    });
    const result = await this.getClient().send(command);

    return Buffer.from(await result.Body!.transformToByteArray());
  }

  async getUrl(key: string) {

    if (this.isLocal()) {
      return `/api/files/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET'),
      Key: key,
      ResponseCacheControl: `private, max-age=${CACHE}`,
    });
    const signingDate = new Date(Math.floor(Date.now() / SIGNING) * SIGNING);

    return getSignedUrl(this.getClient(), command, {expiresIn: URL_LIFETIME, signingDate});
  }
}
