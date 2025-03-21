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

// 一時ファイルのクリーンアップタスク設定
export function setupTempFilesCleanup() {
  // 24時間ごとに実行
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24時間
  
  setInterval(() => {
    try {
      console.log('一時ファイルのクリーンアップを開始します...');
      const now = Date.now();
      const tempFiles = fs.readdirSync(config.tempDir);
      
      let removedCount = 0;
      
      tempFiles.forEach(file => {
        const filePath = path.join(config.tempDir, file);
        
        try {
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtimeMs;
          
          // ファイルの有効期限（24時間）を過ぎていれば削除
          if (fileAge > config.tempFileTtl) {
            fs.unlinkSync(filePath);
            removedCount++;
          }
        } catch (error) {
          console.error(`ファイル処理エラー: ${filePath}`, error);
        }
      });
      
      console.log(`クリーンアップ完了: ${removedCount}ファイルを削除しました。`);
    } catch (error) {
      console.error('一時ファイルクリーンアップエラー:', error);
    }
  }, CLEANUP_INTERVAL);
  
  console.log('一時ファイルのクリーンアップタスクが設定されました。');
}