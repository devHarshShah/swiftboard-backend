import { Injectable } from '@nestjs/common';
import { AddMessageDto } from './dto/chat.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class ChatService {
  // S3 client
  private readonly s3Client: S3Client;

  constructor(
    private prismaService: PrismaService,
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    this.logger.setContext('ChatService');

    // Get AWS configuration
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    // Log configuration (without exposing the secret)
    this.logger.log(
      `AWS Configuration: Region=${region}, AccessKeyId=${accessKeyId ? 'provided' : 'missing'}, SecretKey=${secretAccessKey ? 'provided' : 'missing'}`,
    );

    // Initialize S3 client with detailed error handling
    if (!region || !accessKeyId || !secretAccessKey) {
      this.logger.error('AWS credentials are not properly configured');
    }

    this.s3Client = new S3Client({
      region: region || 'us-east-1', // Provide a default region
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  async addMessage(addMessageDto: AddMessageDto) {
    this.logger.log(
      `Adding new message from ${addMessageDto.sender} to ${addMessageDto.receiver}`,
    );

    try {
      const message = await this.prismaService.message.create({
        data: {
          text: addMessageDto.text,
          sender: {
            connect: { id: addMessageDto.sender },
          },
          receiver: {
            connect: { id: addMessageDto.receiver },
          },
        },
      });

      this.logger.debug(`Message created with ID: ${message.id}`);
      return message;
    } catch (error) {
      this.logger.error(
        `Failed to create message: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getMessagesBetweenUsers(userId1: string, userId2: string) {
    this.logger.log(
      `Retrieving messages between users ${userId1} and ${userId2}`,
    );

    try {
      // Get messages where userId1 is sender and userId2 is receiver
      // OR userId2 is sender and userId1 is receiver
      // Order by sentAt (creation time) to maintain chronological order
      const messages = await this.prismaService.message.findMany({
        where: {
          OR: [
            {
              senderId: userId1,
              receiverId: userId2,
            },
            {
              senderId: userId2,
              receiverId: userId1,
            },
          ],
        },
        orderBy: {
          sentAt: 'asc',
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
            },
          },
          attachments: {
            select: {
              id: true,
              filename: true,
              fileType: true,
              fileSize: true,
              s3Url: true,
              contentType: true,
            },
          },
        },
      });

      this.logger.debug(`Retrieved ${messages.length} messages between users`);
      return messages;
    } catch (error) {
      this.logger.error(
        `Error retrieving messages between users: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async uploadFileToS3(file: Express.Multer.File, userId: string) {
    this.logger.log(
      `Uploading file ${file.originalname} (${file.size} bytes) for user ${userId}`,
    );

    try {
      // Generate a unique key for S3
      const fileExtension = file.originalname.split('.').pop();
      const randomName = crypto.randomBytes(16).toString('hex');
      const key = `chat-uploads/${userId}/${randomName}.${fileExtension}`;
      const bucketName = this.configService.get<string>('S3_BUCKET_NAME');

      this.logger.debug(`Generated S3 key: ${key} for bucket: ${bucketName}`);

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);
      this.logger.debug(`File uploaded successfully to S3`);

      // Determine content type category
      let contentType = 'document';
      if (file.mimetype.startsWith('image/')) contentType = 'image';
      if (file.mimetype.startsWith('video/')) contentType = 'video';
      if (file.mimetype.startsWith('audio/')) contentType = 'audio';

      // Create attachment record without messageId
      const attachment = await this.prismaService.messageAttachment.create({
        data: {
          filename: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          s3Key: key,
          s3Bucket: bucketName || '',
          s3Region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
          s3Url: `https://${bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`,
          contentType,
          // No messageId needed here
        },
      });

      this.logger.log(`Attachment record created with ID: ${attachment.id}`);
      return attachment;
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  async addMessageWithAttachment(messageDto: AddMessageDto, attachment: any) {
    this.logger.log(`Creating message with attachment ID: ${attachment.id}`);
    this.logger.debug(
      `Message details - Sender: ${messageDto.sender}, Receiver: ${messageDto.receiver}, Text length: ${messageDto.text?.length || 0}`,
    );

    try {
      // Create message with proper sender and receiver relations
      const message = await this.prismaService.message.create({
        data: {
          text: messageDto.text,
          sender: {
            connect: { id: messageDto.sender },
          },
          receiver: {
            connect: { id: messageDto.receiver },
          },
          attachments: {
            connect: { id: attachment.id },
          },
          status: 'SENT',
        },
        include: {
          attachments: true,
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          receiver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      this.logger.log(
        `Message created with ID: ${message.id} and attachment connected`,
      );
      return message;
    } catch (error) {
      this.logger.error(
        `Failed to create message with attachment: ${error.message}`,
        error.stack,
      );
      throw new Error(`Message creation failed: ${error.message}`);
    }
  }

  async generatePresignedUrl(attachmentId: string) {
    this.logger.log(`Generating presigned URL for attachment: ${attachmentId}`);

    try {
      // Get attachment details
      const attachment = await this.prismaService.messageAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment) {
        this.logger.warn(`Attachment not found: ${attachmentId}`);
        throw new Error('Attachment not found');
      }

      this.logger.debug(
        `Found attachment: ${attachment.filename} (${attachment.fileType})`,
      );

      // Generate presigned URL (valid for 1 hour)
      const command = new GetObjectCommand({
        Bucket: attachment.s3Bucket,
        Key: attachment.s3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600,
      });

      this.logger.debug(
        `Presigned URL generated successfully (expires in 1 hour)`,
      );

      return {
        url,
        filename: attachment.filename,
        contentType: attachment.fileType,
        size: attachment.fileSize,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL: ${error.message}`,
        error.stack,
      );
      throw new Error(`URL generation failed: ${error.message}`);
    }
  }
}
