import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { isValidFileId, getTempFilePath, getMimeType, sanitizeFilename } from '../utils/fileUtils';
import { config } from '../config';

/**
 * 一時ファイルの取得処理
 */
export const getTempFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // ファイル名のバリデーション
    if (!filename || !isValidFileId(filename)) {
      res.status(400).json({
        error: "無効なファイル名です。",
      });
      return;
    }

    // 一時ファイルのパスを取得
    const filePath = getTempFilePath(filename);

    // ファイルの存在チェック
    try {
      await fs.access(filePath);
    } catch (error) {
      res.status(404).json({
        error: `ファイルが見つかりません。: ${error}`,
      });
      return;
    }

    // ファイルを読み込み
    const fileBuffer = await fs.readFile(filePath);

    // MIMEタイプを取得
    const contentType = getMimeType(filename) || "application/octet-stream";

    // クロスオリジンリソースポリシーとCORSヘッダーを設定
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24時間

    // レスポンスを返す
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(fileBuffer);
  } catch (error) {
    console.error("一時ファイル取得エラー:", error);
    
    res.status(500).json({
      error: "ファイルの取得中にエラーが発生しました。",
    });
  }
};

/**
 * ファイルダウンロード処理
 */
export const downloadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    // クエリパラメータからファイル名を取得
    const fileName = req.query.file as string;

    // ファイル名のバリデーション
    if (!fileName || !isValidFileId(fileName)) {
      res.status(400).json({
        error: "無効なファイル名です。",
      });
      return;
    }

    // ファイルパスを構築
    const filePath = path.join(config.tempDir, fileName);

    // ファイルの存在チェック
    try {
      await fs.access(filePath);
    } catch (error) {
      res.status(404).json({
        error: `ファイルが見つかりません。: ${error}`,
      });
      return;
    }

    // ファイルを読み込み
    const fileBuffer = await fs.readFile(filePath);

    // MIMEタイプを取得
    const contentType = getMimeType(fileName) || "application/octet-stream";

    // 元のファイル名から拡張子を取得
    const extension = path.extname(fileName);
    
    // ダウンロード用のファイル名を生成
    const downloadFileName = sanitizeFilename(`c2pa_signed_${Date.now()}${extension}`);

    // クロスオリジンリソースポリシーとCORSヘッダーを設定
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24時間

    // レスポンスを返す
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  } catch (error) {
    console.error("ファイルダウンロードエラー:", error);
    
    res.status(500).json({
      error: "ファイルのダウンロード中にエラーが発生しました。",
    });
  }
};

/**
 * サーバー上の一時ファイル一覧を取得（管理用）
 */
export const listTempFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    // セキュリティチェック（本番環境では適切な認証を実装すること）
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
      res.status(403).json({
        error: "アクセスが拒否されました。",
      });
      return;
    }

    // 一時ディレクトリのファイル一覧を取得
    const files = await fs.readdir(config.tempDir);
    
    // ファイル情報を取得
    const fileInfos = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.join(config.tempDir, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            isExpired: (Date.now() - stats.mtimeMs) > config.tempFileTtl
          };
        } catch (error) {
          console.error(`ファイル情報取得エラー: ${file}`, error);
          return null;
        }
      })
    );

    // nullでない結果のみをフィルタリング
    const validFileInfos = fileInfos.filter(info => info !== null);

    res.json({
      success: true,
      count: validFileInfos.length,
      files: validFileInfos,
      tempDir: config.tempDir
    });
  } catch (error) {
    console.error("一時ファイル一覧取得エラー:", error);
    
    res.status(500).json({
      error: "一時ファイル一覧の取得中にエラーが発生しました。",
    });
  }
};

/**
 * 一時ファイルの削除（管理用）
 */
export const deleteTempFile = async (req: Request, res: Response): Promise<void> => {
  try {
    // セキュリティチェック（本番環境では適切な認証を実装すること）
    const adminToken = req.headers['x-admin-token'];
    if (adminToken !== process.env.ADMIN_TOKEN) {
      res.status(403).json({
        error: "アクセスが拒否されました。",
      });
      return;
    }

    const { filename } = req.params;

    // ファイル名のバリデーション
    if (!filename || !isValidFileId(filename)) {
      res.status(400).json({
        error: "無効なファイル名です。",
      });
      return;
    }

    // ファイルパスを構築
    const filePath = path.join(config.tempDir, filename);

    // ファイルの存在チェック
    try {
      await fs.access(filePath);
    } catch (error) {
      res.status(404).json({
        error: `ファイルが見つかりません。: ${error}`,
      });
      return;
    }

    // ファイルを削除
    await fs.unlink(filePath);

    res.json({
      success: true,
      message: `ファイル "${filename}" を削除しました。`
    });
  } catch (error) {
    console.error("一時ファイル削除エラー:", error);
    
    res.status(500).json({
      error: "一時ファイルの削除中にエラーが発生しました。",
    });
  }
};