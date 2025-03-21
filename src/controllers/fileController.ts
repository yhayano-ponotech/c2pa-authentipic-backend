import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { isValidFileId, getTempFilePath, getMimeType } from '../utils/fileUtils';
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
    const extension = path.extname(filename).toLowerCase();
    const contentType = getMimeType(filename) || "application/octet-stream";

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
    const extension = path.extname(fileName).toLowerCase();
    const contentType = getMimeType(fileName) || "application/octet-stream";

    // ダウンロード用のファイル名を生成
    const downloadFileName = `c2pa_signed_${Date.now()}${extension}`;

    // レスポンスを返す
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFileName}"`);
    res.send(fileBuffer);
  } catch (error) {
    console.error("ファイルダウンロードエラー:", error);
    
    res.status(500).json({
      error: "ファイルのダウンロード中にエラーが発生しました。",
    });
  }
};