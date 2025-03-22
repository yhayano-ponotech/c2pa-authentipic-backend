import express from 'express';
import { getTrustStatus, updateTrustLists } from '../controllers/trustController';

const router = express.Router();

/**
 * @route GET /api/trust/status
 * @desc 証明書トラストリストの状態を取得
 * @access Public
 */
router.get('/status', getTrustStatus);

/**
 * @route POST /api/trust/update
 * @desc 証明書トラストリストを手動で更新（管理者用）
 * @access Private - 管理者のみ
 */
router.post('/update', updateTrustLists);

export const trustRoutes = router;