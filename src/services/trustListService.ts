import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { config } from '../config';

// トラストリスト関連の設定
const trustConfig = config.c2pa.trust;
const CACHE_DIR = path.join(os.tmpdir(), 'c2pa-trust-cache');
const ALLOWED_CERTS_PATH = path.join(CACHE_DIR, trustConfig.sources.allowedCerts);
const ALLOWED_HASHES_PATH = path.join(CACHE_DIR, trustConfig.sources.allowedHashes);
const ANCHOR_CERTS_PATH = path.join(CACHE_DIR, trustConfig.sources.anchorCerts);
const STORE_CFG_PATH = path.join(CACHE_DIR, trustConfig.sources.storeCfg);

// リソースのURL
const TRUST_BASE_URL = trustConfig.sources.baseUrl;
const ALLOWED_CERTS_URL = `${TRUST_BASE_URL}/${trustConfig.sources.allowedCerts}`;
const ALLOWED_HASHES_URL = `${TRUST_BASE_URL}/${trustConfig.sources.allowedHashes}`;
const ANCHOR_CERTS_URL = `${TRUST_BASE_URL}/${trustConfig.sources.anchorCerts}`;
const STORE_CFG_URL = `${TRUST_BASE_URL}/${trustConfig.sources.storeCfg}`;

// キャッシュのメタデータファイル
const CACHE_METADATA_PATH = path.join(CACHE_DIR, 'metadata.json');

// キャッシュのメタデータの型
interface CacheMetadata {
  lastUpdated: number;
  nextRefreshAt: number;
  files: {
    [key: string]: {
      path: string;
      url: string;
      lastUpdated: number;
      size: number;
      hash?: string;
    }
  }
}

/**
 * トラストリストのキャッシュメタデータを取得
 */
async function getCacheMetadata(): Promise<CacheMetadata> {
  try {
    const metadata = await fs.readFile(CACHE_METADATA_PATH, 'utf8');
    return JSON.parse(metadata);
  } catch (error) {
    // メタデータファイルが存在しない場合やパースエラーの場合は新規作成
    return {
      lastUpdated: 0,
      nextRefreshAt: 0,
      files: {}
    };
  }
}

/**
 * キャッシュメタデータを保存
 */
async function saveCacheMetadata(metadata: CacheMetadata): Promise<void> {
  await fs.writeFile(CACHE_METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');
}

/**
 * ファイルをダウンロードして保存する関数
 */
async function downloadTrustFile(url: string, destPath: string): Promise<{success: boolean; size?: number}> {
  try {
    console.log(`Downloading trust resource from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const content = await response.text();
    await fs.writeFile(destPath, content, 'utf-8');
    console.log(`Downloaded and saved to ${destPath}`);
    
    // ファイルサイズを取得
    const stats = await fs.stat(destPath);
    return { success: true, size: stats.size };
  } catch (error) {
    console.error(`Failed to download from ${url}:`, error);
    return { success: false };
  }
}

/**
 * キャッシュディレクトリが存在するか確認し、なければ作成する
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create cache directory:', error);
    throw new Error(`Failed to create cache directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * トラストリストを更新する関数
 * バックグラウンドで実行される
 */
export async function updateTrustLists(): Promise<boolean> {
  if (!trustConfig.enabled) {
    console.log('Trust list verification is disabled.');
    return false;
  }

  try {
    await ensureCacheDir();
    
    // メタデータを取得
    const metadata = await getCacheMetadata();
    const now = Date.now();
    
    // 更新が必要かチェック
    if (metadata.nextRefreshAt > now) {
      console.log('Trust lists are still valid, no update needed.');
      return true;
    }
    
    console.log('Updating trust lists...');
    
    // ファイルのダウンロード
    const downloadTasks = [
      { url: ALLOWED_CERTS_URL, path: ALLOWED_CERTS_PATH, key: 'allowedCerts' },
      { url: ALLOWED_HASHES_URL, path: ALLOWED_HASHES_PATH, key: 'allowedHashes' },
      { url: ANCHOR_CERTS_URL, path: ANCHOR_CERTS_PATH, key: 'anchorCerts' },
      { url: STORE_CFG_URL, path: STORE_CFG_PATH, key: 'storeCfg' }
    ];
    
    // 並列ダウンロード
    const results = await Promise.all(
      downloadTasks.map(async task => {
        const result = await downloadTrustFile(task.url, task.path);
        return { ...task, result };
      })
    );
    
    // メタデータを更新
    let allSuccess = true;
    for (const { key, path, url, result } of results) {
      if (result.success) {
        metadata.files[key] = {
          path,
          url,
          lastUpdated: now,
          size: result.size || 0
        };
      } else {
        allSuccess = false;
      }
    }
    
    // グローバルメタデータの更新
    metadata.lastUpdated = now;
    metadata.nextRefreshAt = now + trustConfig.cacheConfig.refreshInterval;
    
    // メタデータの保存
    await saveCacheMetadata(metadata);
    
    console.log('Trust lists updated successfully.');
    return allSuccess;
  } catch (error) {
    console.error('Error updating trust lists:', error);
    return false;
  }
}

/**
 * トラストリストのパスを取得する
 * キャッシュが存在しない場合は更新を試みる
 */
export async function getTrustListPaths(): Promise<{
  allowedCertsPath: string;
  allowedHashesPath: string;
  anchorCertsPath: string;
  storeCfgPath: string;
} | null> {
  if (!trustConfig.enabled) {
    return null;
  }

  try {
    await ensureCacheDir();
    
    // メタデータを取得
    const metadata = await getCacheMetadata();
    const now = Date.now();
    
    // キャッシュが無効であれば更新
    if (metadata.lastUpdated === 0 || metadata.nextRefreshAt < now) {
      const updated = await updateTrustLists();
      if (!updated) {
        console.warn('Failed to update trust lists, using existing ones if available.');
      }
    }
    
    // ファイルの存在をチェック
    try {
      await Promise.all([
        fs.access(ALLOWED_CERTS_PATH),
        fs.access(ALLOWED_HASHES_PATH),
        fs.access(ANCHOR_CERTS_PATH),
        fs.access(STORE_CFG_PATH)
      ]);
    } catch (error) {
      console.warn('Some trust list files are missing, attempting to download...');
      await updateTrustLists();
    }
    
    return {
      allowedCertsPath: ALLOWED_CERTS_PATH,
      allowedHashesPath: ALLOWED_HASHES_PATH,
      anchorCertsPath: ANCHOR_CERTS_PATH,
      storeCfgPath: STORE_CFG_PATH
    };
  } catch (error) {
    console.error('Error getting trust list paths:', error);
    return null;
  }
}

/**
 * トラストリストファイルの内容を取得する
 */
export async function getTrustListContents(): Promise<{
  trustAnchors: string;
  allowedList: string;
  allowedHashes: string;
  trustConfig: string;
} | null> {
  const paths = await getTrustListPaths();
  if (!paths) {
    return null;
  }
  
  try {
    const [trustAnchors, allowedList, allowedHashes, trustConfig] = await Promise.all([
      fs.readFile(paths.anchorCertsPath, 'utf8'),
      fs.readFile(paths.allowedCertsPath, 'utf8'),
      fs.readFile(paths.allowedHashesPath, 'utf8'),
      fs.readFile(paths.storeCfgPath, 'utf8')
    ]);
    
    return {
      trustAnchors,
      allowedList,
      allowedHashes,
      trustConfig
    };
  } catch (error) {
    console.error('Error reading trust list files:', error);
    return null;
  }
}

/**
 * トラストリストのステータスを確認する
 * サーバー稼働状況の確認などに使用
 */
export async function getTrustListStatus(): Promise<{
  enabled: boolean;
  available: boolean;
  lastUpdated: string | null;
  nextRefresh: string | null;
  files: Record<string, { size: number; lastUpdated: string | null }>
}> {
  if (!trustConfig.enabled) {
    return {
      enabled: false,
      available: false,
      lastUpdated: null,
      nextRefresh: null,
      files: {}
    };
  }
  
  try {
    const metadata = await getCacheMetadata();
    const fileStatus: Record<string, { size: number; lastUpdated: string | null }> = {};
    
    for (const [key, info] of Object.entries(metadata.files)) {
      fileStatus[key] = {
        size: info.size,
        lastUpdated: info.lastUpdated ? new Date(info.lastUpdated).toISOString() : null
      };
    }
    
    return {
      enabled: true,
      available: metadata.lastUpdated > 0,
      lastUpdated: metadata.lastUpdated ? new Date(metadata.lastUpdated).toISOString() : null,
      nextRefresh: metadata.nextRefreshAt ? new Date(metadata.nextRefreshAt).toISOString() : null,
      files: fileStatus
    };
  } catch (error) {
    console.error('Error getting trust list status:', error);
    return {
      enabled: true,
      available: false,
      lastUpdated: null,
      nextRefresh: null,
      files: {}
    };
  }
}