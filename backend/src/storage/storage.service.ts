import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

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
    const command = new PutObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET'),
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.getClient().send(command);
  }

  async remove(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET'),
      Key: key,
    });

    await this.getClient().send(command);
  }

  getUrl(key: string) {
    const command = new GetObjectCommand({
      Bucket: this.config.getOrThrow<string>('B2_BUCKET'),
      Key: key,
    });

    return getSignedUrl(this.getClient(), command, {expiresIn: 3600});
  }
}
