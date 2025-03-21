import express from 'express';
import { upload } from '../middlewares/upload';
import { 
  uploadFile, 
  readC2pa, 
  signC2pa, 
  verifyC2pa 
} from '../controllers/c2paController';

const router = express.Router();

// C2PA画像アップロードエンドポイント
router.post('/upload', upload.single('file'), uploadFile);

// C2PA情報読み取りエンドポイント
router.post('/read', readC2pa);

// C2PA署名エンドポイント
router.post('/sign', signC2pa);

// C2PA検証エンドポイント
router.post('/verify', verifyC2pa);

export const c2paRoutes = router;
