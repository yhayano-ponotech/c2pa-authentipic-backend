import express from 'express';
import { upload } from '../middlewares/upload';
import { 
  uploadFile, 
  readC2pa, 
  signC2pa, 
  verifyC2pa 
} from '../controllers/c2paController';

const router = express.Router();

/**
 * @route POST /api/c2pa/upload
 * @desc C2PA画像アップロードエンドポイント
 * @access Public
 */
router.post('/upload', upload.single('file'), uploadFile);

/**
 * @route POST /api/c2pa/read
 * @desc C2PA情報読み取りエンドポイント
 * @access Public
 */
router.post('/read', readC2pa);

/**
 * @route POST /api/c2pa/sign
 * @desc C2PA署名エンドポイント
 * @access Public
 */
router.post('/sign', signC2pa);

/**
 * @route POST /api/c2pa/verify
 * @desc C2PA検証エンドポイント
 * @access Public
 */
router.post('/verify', verifyC2pa);

export const c2paRoutes = router;