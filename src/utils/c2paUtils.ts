import { C2paAssertion } from '../types';

/**
 * C2PAモジュールをダイナミックインポートで遅延ロード
 */
export async function loadC2pa() {
  try {
    const { createC2pa, createTestSigner, ManifestBuilder, SigningAlgorithm } = await import('c2pa-node');
    return { createC2pa, createTestSigner, ManifestBuilder, SigningAlgorithm };
  } catch (error) {
    console.error("C2PAモジュールのロードエラー:", error);
    throw new Error("C2PAモジュールのロードに失敗しました");
  }
}

/**
 * マニフェストにアサーションを追加するヘルパー関数
 */
export function addAssertion(manifest: any, assertion: C2paAssertion) {
  // 既存のassertions配列を取得
  const assertions = manifest.assertions || [];
  
  // 新しいアサーションを追加
  assertions.push(assertion);
  
  // 更新されたassertions配列でマニフェストを更新
  manifest.assertions = assertions;
  
  return manifest;
}
