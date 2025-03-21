import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { c2paRoutes } from './routes/c2paRoutes';
import { fileRoutes } from './routes/fileRoutes';
import { setupTempFilesCleanup } from './middlewares/upload';

// Expressアプリケーションを初期化
const app = express();

// ミドルウェアの設定
app.use(cors(config.cors)); // CORSを有効化
app.use(helmet()); // セキュリティヘッダーを設定
app.use(morgan(config.logging.format)); // リクエストログを出力
app.use(express.json()); // JSONボディパーサー

// 一時ディレクトリの作成（存在しない場合）
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

// 一時ファイルのクリーンアップタスクをセットアップ
setupTempFilesCleanup();

// ルートの設定
app.use('/api/c2pa', c2paRoutes);
app.use('/api/temp', fileRoutes);
app.use('/api/download', fileRoutes);
app.use('/api/files', fileRoutes);

// ルートへのリクエストに対するレスポンス
app.get('/', (req, res) => {
  res.json({ 
    message: 'C2PA Authentication API Server',
    version: config.appInfo.version,
    documentation: `${req.protocol}://${req.get('host')}/api-docs`
  });
});

// エラーハンドリングミドルウェア
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server Error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'サーバーエラーが発生しました。';
  
  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString()
    }
  });
});

// サーバー起動
app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Temporary directory: ${config.tempDir}`);
});

export default app;