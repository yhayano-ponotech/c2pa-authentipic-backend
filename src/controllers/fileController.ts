import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { isValidFileId, getTempFilePath, getMimeType } from '../utils/fileUtils';
import { config } from '../config';

/**
 * 一時ファイルの取得処理
 */
export const getTempFile = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // ファイル名のバリデーション
    if (!filename || !isValidFileId(filename)) {
      return res.status(400).json({
        error: "無効なファイル名です。",
      });
    }

    // 一時ファイルのパスを取得
    const filePath = getTempFilePath(filename);

    // ファイルの存在チェック
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        error: `ファイルが見つかりません。: ${error}`,
      });
    }

    // ファイルを読み込み
    const fileBuffer = await fs.readFile(filePath);

    // MIMEタイプを取得
    const extension = path.extname(filename).toLowerCase();
    const contentType = getMimeType(extension) || "application/octet-stream";

    // レスポンスを返す
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(fileBuffer);
  } catch (error) {
    console.error("一時ファイル取得エラー:", error);
    
    return res.status(500).json({
      error: "ファイルの取得中にエラーが発生しました。",
    });
  }
};

/**
 * ファイルダウンロード処理
 */
export const downloadFile = async (req: Request, res: Response) => {
  try {
    // クエリパラメータからファイル名を取得
    const fileName = req.query.file as string;

    // ファイル名のバリデーション
    if (!fileName || !isValidFileId(fileName)) {
      return res.status(400).json({
        error: "無効なファイル名です。",
      });
    }

    // ファイルパスを構築
    const filePath = path.join(config.tempDir, fileName);

    // ファイルの存在チェック
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        error: `ファイルが見つかりません。: ${error}`,
      });
    }

    // ファイルを読み込み
    const fileBuffer = await fs.readFile(filePath);

    // MIMEタイプを取得
    const extension = path.extname(fileName).toLowerCase();
    const contentType = getMimeType(extension) || "application/octet-stream";

    // ダウンロード用のファイル名を生成
    const downloadFileName = `c2pa_signed_${Date.now()}${extension}`;

    // レスポンスを返す
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
    return res.send(fileBuffer);
  } catch (error) {
    console.error("ファイルダウンロードエラー:", error);
    
    return res.status(500).json({
      error: "ファイルのダウンロード中にエラーが発生しました。",
    });
  }
};
