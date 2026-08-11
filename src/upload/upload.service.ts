import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(file: Express.Multer.File, folder = 'general'): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `bhavani-pickles/${process.env.NODE_ENV || 'development'}/${folder}`, resource_type: 'image' },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve(result.secure_url);
        },
      );
      uploadStream.end(file.buffer);
    }).catch((error) => {
      this.logger.error('Cloudinary upload error', error);
      throw new InternalServerErrorException(`Upload failed: ${error?.message || error}`);
    }) as Promise<string>;
  }

  async uploadImages(files: Express.Multer.File[], folder = 'general'): Promise<string[]> {
    return Promise.all(files.map((f) => this.uploadImage(f, folder)));
  }

  async deleteImage(url: string): Promise<void> {
    try {
      // Extract public_id from Cloudinary URL
      const parts = url.split('/');
      const folderIndex = parts.indexOf('bhavani-pickles');
      if (folderIndex !== -1) {
        const publicId = parts
          .slice(folderIndex)
          .join('/')
          .replace(/\.[^/.]+$/, ''); // remove extension
        await cloudinary.uploader.destroy(publicId);
      }
    } catch {
      // Ignore if file not found
    }
  }
}
