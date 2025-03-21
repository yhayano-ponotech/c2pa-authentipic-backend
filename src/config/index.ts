import path from 'path';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3001,
  tempDir: process.env.TEMP_DIR || path.join(__dirname, '../../tmp/c2pa-web-app-temp'),
  tempFileTtl: 24 * 60 * 60 * 1000, // 24時間
  maxUploadSize: 10 * 1024 * 1024, // 10MB
  supportedImageFormats: [
    { extension: '.jpg', mimeType: 'image/jpeg' },
    { extension: '.jpeg', mimeType: 'image/jpeg' },
    { extension: '.png', mimeType: 'image/png' },
    { extension: '.webp', mimeType: 'image/webp' },
    { extension: '.tif', mimeType: 'image/tiff' },
    { extension: '.tiff', mimeType: 'image/tiff' },
    { extension: '.avif', mimeType: 'image/avif' },
    { extension: '.heic', mimeType: 'image/heic' },
    { extension: '.heif', mimeType: 'image/heif' },
    { extension: '.gif', mimeType: 'image/gif' }
  ]
};
