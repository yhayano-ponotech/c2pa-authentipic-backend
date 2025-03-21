import express from 'express';
import { getTempFile, downloadFile } from '../controllers/fileController';

const router = express.Router();

// 一時ファイル取得エンドポイント
router.get('/:filename', getTempFile);

// ファイルダウンロードエンドポイント
router.get('/', downloadFile);

export const fileRoutes = router;
