import { AssetMetadata, C2paAssertion } from '../types';
import { createHash } from 'crypto';
import fs from 'fs/promises';

/**
 * 画像メタデータからハッシュを生成する
 * @param metadata 画像メタデータ
 * @returns SHA-256ハッシュ（16進数文字列）
 */
export function generateAssetHash(metadata: AssetMetadata): string {
  const hashData = JSON.stringify({
    size: metadata.size,
    name: metadata.name,
    type: metadata.mimeType,
    lastModified: metadata.lastModified
  });
  
  return createHash('sha256').update(hashData).digest('hex');
}

/**
 * ファイルコンテンツからハッシュを生成する
 * @param filePath ファイルパス
 * @returns SHA-256ハッシュ（16進数文字列）
 */
export async function generateFileHash(filePath: string): Promise<string> {
  const fileContent = await fs.readFile(filePath);
  return createHash('sha256').update(fileContent).digest('hex');
}

/**
 * C2PAアサーションを作成するヘルパー関数
 * @param label アサーションラベル
 * @param data アサーションデータ
 * @returns C2PAアサーション
 */
export function createAssertion(label: string, data: Record<string, unknown>): C2paAssertion {
  return {
    label,
    data
  };
}

/**
 * C2PA作成アクションアサーションを生成する
 * @param timestamp タイムスタンプ（デフォルトは現在時刻）
 * @returns C2PA作成アクションアサーション
 */
export function createCreatedAction(timestamp?: string): C2paAssertion {
  return {
    label: "c2pa.actions",
    data: {
      actions: [
        {
          action: "c2pa.created",
          when: timestamp || new Date().toISOString()
        }
      ]
    }
  };
}

/**
 * C2PAメタデータアサーションを生成する
 * @param appName アプリケーション名
 * @param appVersion アプリケーションバージョン
 * @returns C2PAメタデータアサーション
 */
export function createMetadataAssertion(appName: string, appVersion: string): C2paAssertion {
  return {
    label: "c2pa.metadata",
    data: {
      generator: {
        name: appName,
        version: appVersion
      },
      tool: {
        name: "c2pa-node",
        version: "0.5.23" // ライブラリのバージョンに合わせて更新
      }
    }
  };
}

/**
 * 著作者情報アサーションを生成する
 * @param creator 著作者名
 * @returns DC作成者アサーション
 */
export function createCreatorAssertion(creator: string): C2paAssertion {
  return {
    label: "dc.creator",
    data: { value: creator }
  };
}

/**
 * 著作権情報アサーションを生成する
 * @param copyright 著作権情報
 * @returns DC著作権アサーション
 */
export function createCopyrightAssertion(copyright: string): C2paAssertion {
  return {
    label: "dc.rights",
    data: { value: copyright }
  };
}

/**
 * 説明情報アサーションを生成する
 * @param description 説明文
 * @returns DC説明アサーション
 */
export function createDescriptionAssertion(description: string): C2paAssertion {
  return {
    label: "dc.description",
    data: { value: description }
  };
}