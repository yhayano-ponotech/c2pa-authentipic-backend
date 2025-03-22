import { getTrustListContents } from '../services/trustListService';

/**
 * C2PAの読み取りオプションを作成する
 * トラストリストを含めた設定を返す
 */
export async function createC2paTrustOptions(): Promise<any> {
  try {
    // トラストリストサービスからコンテンツを取得
    const contents = await getTrustListContents();
    
    if (!contents) {
      console.warn('Trust list contents are not available.');
      return null;
    }
    
    const { trustAnchors, allowedList, allowedHashes, trustConfig } = contents;
    
    // 読み取りオプションを作成
    return {
      trust: {
        trustConfig,
        trustAnchors,
        allowedList,
        allowedHashes
      },
      verify: {
        verifyTrust: true
      }
    };
  } catch (error) {
    console.error('Error creating trust options:', error);
    // エラー時には検証せずに続行できるようnullを返す
    return null;
  }
}

/**
 * 証明書信頼性情報を抽出する関数
 * @param c2paData C2PAデータ
 * @returns 証明書信頼性情報
 */
export function extractCertificateTrustInfo(
  c2paData: any
): {
  isTrusted: boolean;
  issuer: string | null;
  timestamp: string | null;
  errorMessage: string | null;
} {
  if (!c2paData) {
    return {
      isTrusted: false,
      issuer: null,
      timestamp: null,
      errorMessage: "C2PAデータがありません"
    };
  }
  
  try {
    // 検証ステータスをチェック
    const validationStatus = c2paData.validation_status || [];
    
    // 証明書関連のエラーがあるか確認
    const certificateErrors = validationStatus.filter((status: any) => {
      const code = status.code || '';
      const explanation = status.explanation || '';
      return (
        code.toLowerCase().includes('cert') || 
        code.toLowerCase().includes('trust') || 
        explanation.toLowerCase().includes('certificate') || 
        explanation.toLowerCase().includes('trusted')
      );
    });
    
    // アクティブマニフェストから発行者と署名日時を取得
    let issuer = null;
    let timestamp = null;
    
    const activeManifest = c2paData.active_manifest;
    if (activeManifest && activeManifest.signature_info) {
      issuer = activeManifest.signature_info.issuer || null;
      timestamp = activeManifest.signature_info.time || null;
    }
    
    // 検証結果の判定
    if (certificateErrors.length > 0) {
      const errorMessages = certificateErrors.map((error: any) => 
        error.explanation || error.code || '不明なエラー'
      ).join('; ');
      
      return {
        isTrusted: false,
        issuer,
        timestamp,
        errorMessage: errorMessages
      };
    } else {
      // エラーがなければ信頼できる
      return {
        isTrusted: true,
        issuer,
        timestamp,
        errorMessage: null
      };
    }
  } catch (error) {
    console.error('Error extracting certificate trust info:', error);
    return {
      isTrusted: false,
      issuer: null,
      timestamp: null,
      errorMessage: `証明書信頼性情報の抽出エラー: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}