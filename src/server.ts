import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { c2paRoutes } from './routes/c2paRoutes';
import { fileRoutes } from './routes/fileRoutes';
import { trustRoutes } from './routes/trustRoutes';
import { setupTempFilesCleanup } from './middlewares/upload';
import { updateTrustLists } from './services/trustListService';

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

// 信頼できる証明書リストを初期化
async function initializeTrustLists() {
  if (config.c2pa.trust.enabled) {
    console.log('Initializing trust lists...');
    try {
      const updated = await updateTrustLists();
      console.log(`Trust lists initialization ${updated ? 'successful' : 'failed'}`);
      
      // バックグラウンドで定期的に更新
      const refreshInterval = config.c2pa.trust.cacheConfig.refreshInterval;
      setInterval(async () => {
        console.log('Running scheduled trust lists update...');
        await updateTrustLists();
      }, refreshInterval);
    } catch (error) {
      console.error('Error initializing trust lists:', error);
    }
  } else {
    console.log('Trust list verification is disabled.');
  }
}

// 証明書リストの初期化
initializeTrustLists();

// ルートの設定
app.use('/api/c2pa', c2paRoutes);
app.use('/api/temp', fileRoutes);
app.use('/api/download', fileRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/trust', trustRoutes);

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
  console.log(`Trust list verification: ${config.c2pa.trust.enabled ? 'enabled' : 'disabled'}`);
});

export default app;