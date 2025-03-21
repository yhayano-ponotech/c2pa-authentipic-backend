import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { config } from '../config';
import { generateUniqueId, sanitizeFilename } from '../utils/fileUtils';

// 一時ディレクトリが存在しない場合は作成
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

// ファイル保存用のストレージ設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.tempDir);
  },
  filename: (req, file, cb) => {
    const fileId = generateUniqueId();
    const sanitizedFileName = sanitizeFilename(file.originalname);
    const extension = path.extname(sanitizedFileName);
    const tempFileName = `${fileId}${extension}`;
    cb(null, tempFileName);
  }
});

// ファイルフィルター（許可するファイル形式を制限）
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 許可するMIMEタイプを取得
  const allowedMimeTypes = config.supportedImageFormats.map(format => format.mimeType);
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('サポートされていないファイル形式です。JPG、PNG、WEBP、TIFF、AVIF、HEIC、GIFのいずれかを選択してください。'));
  }
};

// Multerの設定
export const upload = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSize // 10MB
  },
  fileFilter
});
