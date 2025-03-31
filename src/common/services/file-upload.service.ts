import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { LoggerService as Logger } from 'src/logger/logger.service';
import * as path from 'path';
import * as crypto from 'crypto';

// Define allowed file types and max size (in bytes)
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
];

// 5MB max file size
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface UploadOptions {
  allowedTypes?: string[];
  maxSize?: number;
  folder?: string;
}

@Injectable()
export class FileUploadService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private logger: Logger) {
    this.logger.setContext('FileUploadService');

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    this.bucket = process.env.AWS_S3_BUCKET || 'swiftboard-uploads';
  }

  /**
   * Validates file before upload
   */
  validateFile(file: Express.Multer.File, options?: UploadOptions): void {
    const allowedTypes = options?.allowedTypes || ALLOWED_FILE_TYPES;
    const maxSize = options?.maxSize || MAX_FILE_SIZE;

    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }

    // Check file size
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File too large. Maximum size allowed is ${maxSize / (1024 * 1024)}MB`,
      );
    }

    // Check file name for suspicious patterns
    if (/[;<>\$`|]/g.test(file.originalname)) {
      throw new BadRequestException('Invalid characters in file name');
    }
  }

  /**
   * Generates a secure filename
   */
  generateSecureFilename(originalFilename: string): string {
    const ext = path.extname(originalFilename);
    const hash = crypto
      .createHash('sha256')
      .update(originalFilename + Date.now())
      .digest('hex')
      .substring(0, 16);
    const uuid = randomUUID();

    return `${uuid}-${hash}${ext}`;
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<string> {
    // Validate file before upload
    this.validateFile(file, options);

    // Generate secure filename
    const secureFilename = this.generateSecureFilename(file.originalname);

    // Prepare upload path
    const folder = options.folder ? `${options.folder}/` : '';
    const key = `${folder}${secureFilename}`;

    try {
      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentDisposition: 'inline',
          Metadata: {
            originalFilename: Buffer.from(file.originalname).toString('base64'),
          },
        }),
      );

      this.logger.log(`Successfully uploaded file: ${key}`);
      return key;
    } catch (error) {
      this.logger.error('Failed to upload file', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  /**
   * Generate pre-signed URL for file download
   */
  async generatePresignedUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      this.logger.error('Failed to generate presigned URL', error);
      throw new BadRequestException('Failed to generate download URL');
    }
  }
}
