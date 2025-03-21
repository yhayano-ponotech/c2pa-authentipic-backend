import path from 'path';
import crypto from 'crypto';
import { config } from '../config';

/**
 * 一意のIDを生成する関数
 * @returns 16バイトのランダムな16進数文字列
 */
export function generateUniqueId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * ファイル名をサニタイズする関数
 * @param filename ファイル名
 * @returns サニタイズされたファイル名
 */
export function sanitizeFilename(filename: string): string {
  // 基本的な無効な文字を削除または置換
  const sanitized = filename
    .replace(/[/\\?%*:|"<>]/g, "_") // 無効な文字を置換
    .replace(/\s+/g, "_")          // スペースをアンダースコアに置換
    .replace(/\.{2,}/g, ".")       // 連続したドットを単一のドットに置換
    .trim();                       // 前後の空白を削除

  return sanitized;
}

/**
 * ファイルIDが有効かどうかをチェックする関数
 * @param fileId ファイルID
 * @returns 有効な場合はtrue、そうでない場合はfalse
 */
export function isValidFileId(fileId: string): boolean {
  // ベーシックなバリデーション
  // 英数字とダッシュ、アンダースコア、ドット、拡張子のみを許可
  const validFilePattern = /^[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+$/;
  return validFilePattern.test(fileId);
}

/**
 * 一時ファイルのパスを取得する関数
 * @param fileId ファイルID
 * @returns 一時ファイルの完全パス
 */
export function getTempFilePath(fileId: string): string {
  if (!isValidFileId(fileId)) {
    throw new Error("無効なファイルIDです。");
  }
  return path.join(config.tempDir, fileId);
}

/**
 * 日付をフォーマットする関数
 * @param dateString ISO形式の日付文字列
 * @returns フォーマットされた日付文字列
 */
export function formatDate(dateString: string): string {
  if (!dateString) {
    return "日時情報なし";
  }
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    return "無効な日付";
  }
  
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * ファイルの拡張子からMIMEタイプを取得する関数
 * @param filename ファイル名
 * @returns MIMEタイプ（見つからない場合はnull）
 */
export function getMimeType(filename: string): string | null {
  const extension = path.extname(filename).toLowerCase();
  if (!extension) return null;

  const format = config.supportedImageFormats.find(format => 
    format.extension === extension
  );

  return format ? format.mimeType : null;
}

/**
 * MIMEタイプから拡張子を取得する関数
 * @param mimeType MIMEタイプ
 * @returns 拡張子（見つからない場合はnull）
 */
export function getExtensionFromMimeType(mimeType: string): string | null {
  const format = config.supportedImageFormats.find(format => 
    format.mimeType === mimeType
  );

  return format ? format.extension : null;
}

/**
 * ファイルサイズを人間が読みやすい形式に変換する関数
 * @param bytes バイト数
 * @param decimals 小数点以下の桁数
 * @returns フォーマットされたファイルサイズ文字列
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}