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
    { extension: '.jpg', mimeType: 'image/jpeg', name: 'JPEG' },
    { extension: '.jpeg', mimeType: 'image/jpeg', name: 'JPEG' },
    { extension: '.png', mimeType: 'image/png', name: 'PNG' },
    { extension: '.webp', mimeType: 'image/webp', name: 'WebP' },
    { extension: '.tif', mimeType: 'image/tiff', name: 'TIFF' },
    { extension: '.tiff', mimeType: 'image/tiff', name: 'TIFF' },
    { extension: '.avif', mimeType: 'image/avif', name: 'AVIF' },
    { extension: '.heic', mimeType: 'image/heic', name: 'HEIC' },
    { extension: '.heif', mimeType: 'image/heif', name: 'HEIF' },
    { extension: '.gif', mimeType: 'image/gif', name: 'GIF' }
  ],
  appInfo: {
    name: 'C2PA Web App',
    version: '1.0.0',
    description: 'C2PA情報の読み取り、追加、検証を行うWebアプリケーション',
    repository: 'https://github.com/example/c2pa-web-app'
  },
  c2pa: {
    defaultSigningAlgorithm: 'ES256',
    defaultTsaUrl: 'http://timestamp.digicert.com',
    thumbnailOptions: {
      maxSize: 1024,
      quality: 80
    },
    trust: {
      // Content Credentials (C2PA) 信頼リスト設定
      enabled: process.env.ENABLE_TRUST_LIST !== 'false', // デフォルトで有効
      sources: {
        baseUrl: 'https://contentcredentials.org/trust',
        allowedCerts: 'allowed.pem',
        allowedHashes: 'allowed.sha256.txt',
        anchorCerts: 'anchors.pem',
        storeCfg: 'store.cfg'
      },
      cacheConfig: {
        ttl: 24 * 60 * 60 * 1000, // 24時間
        refreshInterval: 12 * 60 * 60 * 1000 // 12時間ごとに更新
      }
    }
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24時間
  },
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
  }
};