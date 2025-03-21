import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { c2paRoutes } from './routes/c2paRoutes';
import { fileRoutes } from './routes/fileRoutes';

// Expressアプリケーションを初期化
const app = express();

// ミドルウェアの設定
app.use(cors()); // CORSを有効化
app.use(helmet()); // セキュリティヘッダーを設定
app.use(morgan('dev')); // リクエストログを出力
app.use(express.json()); // JSONボディパーサー

// 一時ディレクトリの作成（存在しない場合）
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

// ルートの設定
app.use('/api/c2pa', c2paRoutes);
app.use('/api/temp', fileRoutes);
app.use('/api/download', fileRoutes);

// ルートへのリクエストに対するレスポンス
app.get('/', (req, res) => {
  res.json({ message: 'C2PA Authentication API Server' });
});

// サーバー起動
app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

export default app;
