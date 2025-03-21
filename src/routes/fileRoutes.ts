import express from 'express';
import { 
  getTempFile, 
  downloadFile,
  listTempFiles,
  deleteTempFile
} from '../controllers/fileController';

const router = express.Router();

/**
 * @route GET /api/temp/:filename
 * @desc 一時ファイル取得エンドポイント
 * @access Public
 */
router.get('/:filename', getTempFile);

/**
 * @route GET /api/download
 * @desc ファイルダウンロードエンドポイント
 * @access Public
 */
router.get('/', downloadFile);

/**
 * @route GET /api/files/list
 * @desc 一時ファイル一覧取得エンドポイント（管理用）
 * @access Private - 管理者のみ
 */
router.get('/list', listTempFiles);

/**
 * @route DELETE /api/files/:filename
 * @desc 一時ファイル削除エンドポイント（管理用）
 * @access Private - 管理者のみ
 */
router.delete('/:filename', deleteTempFile);

export const fileRoutes = router;