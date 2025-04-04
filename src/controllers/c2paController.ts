import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { 
  isValidFileId, 
  getTempFilePath, 
  getMimeType, 
  generateUniqueId 
} from '../utils/fileUtils';
import { config } from '../config';
import { SignData, C2paManifestData } from '../types';
import { 
  createC2pa, 
  createTestSigner, 
  ManifestBuilder, 
  SigningAlgorithm, 
  BufferAsset, 
  FileAsset,
  ResolvedManifestStore,
  ResolvedManifest
} from 'c2pa-node';
import { createC2paTrustOptions, extractCertificateTrustInfo } from '../utils/trustListUtils';

// シングルトンC2PAインスタンスの作成
const c2paInstance = createC2pa();

/**
 * c2pa-nodeライブラリから返されるResolvedManifestStoreをフロントエンドで期待する
 * C2paManifestData形式に変換する関数
 * @param data c2pa-nodeライブラリから返されるデータ
 * @returns フロントエンド互換の形式に変換されたデータ
 */
function transformC2paDataForFrontend(data: ResolvedManifestStore): C2paManifestData {
  // active_manifestがオブジェクトの場合、そのラベルを文字列として使用
  const activeManifestLabel = data.active_manifest?.label || "";
  
  // マニフェストを変換
  const transformedManifests: Record<string, any> = {};
  Object.entries(data.manifests).forEach(([key, manifest]) => {
    transformedManifests[key] = {
      claim_generator: manifest.claim_generator || "",
      format: manifest.format || "",
      title: manifest.title || "",
      label: manifest.label || "",
      assertions: manifest.assertions || [],
      ingredients: manifest.ingredients || [],
      signature_info: manifest.signature_info || null,
      // その他必要なフィールド
    };
  });

  // フロントエンドの期待する形式に整形
  const transformed: C2paManifestData = {
    active_manifest: activeManifestLabel,
    manifests: transformedManifests,
    validation_status: Array.isArray(data.validation_status) 
      ? data.validation_status[0]?.code || "unknown" 
      : "unknown"
  };

  return transformed;
}

/**
 * ファイルアップロード処理
 */
export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    // ファイルが添付されているか確認
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: "ファイルがアップロードされていません。",
      });
      return;
    }

    const file = req.file;
    
    // ファイル名をサニタイズしてメタデータを作成
    const sanitizedFileName = path.basename(file.originalname);
    const fileId = path.basename(file.path);
    
    // ファイルのURLを生成
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/api/temp/${fileId}`;

    // 成功レスポンスを返す
    res.status(200).json({
      success: true,
      fileId,
      fileName: sanitizedFileName,
      fileType: file.mimetype,
      fileSize: file.size,
      url: fileUrl,
    });
  } catch (error) {
    console.error("ファイルアップロードエラー:", error);
    
    res.status(500).json({
      success: false,
      error: "ファイルのアップロード中にエラーが発生しました。",
    });
  }
};

/**
 * C2PA情報読み取り処理
 */
export const readC2pa = async (req: Request, res: Response): Promise<void> => {
  try {
    // リクエストボディからfileIdを取得
    const { fileId } = req.body;

    // fileIdのバリデーション
    if (!fileId || !isValidFileId(fileId)) {
      res.status(400).json({
        success: false,
        error: "無効なファイルIDです。",
      });
      return;
    }

    // 一時ファイルのパスを取得
    const tempFilePath = getTempFilePath(fileId);

    // ファイルの存在チェック
    try {
      await fs.access(tempFilePath);
    } catch (error) {
      res.status(404).json({
        success: false,
        error: `指定されたファイルが見つかりません。: ${error}`,
      });
      return;
    }

    // MIMEタイプを取得
    const mimeType = getMimeType(fileId);

    if (!mimeType) {
      res.status(400).json({
        success: false,
        error: "サポートされていないファイル形式です。",
      });
      return;
    }

    try {
      // ファイルのC2PA情報を読み取る
      // トラストリストオプションを取得（可能であれば）
      const trustOptions = await createC2paTrustOptions();
      const fileAsset: FileAsset = { path: tempFilePath, mimeType };
      
      // 現在のc2pa-nodeバージョンではread()に設定を渡せないため
      // 標準の方法で読み取り、その後で証明書の検証を行う
      // トラストオプションが利用可能な場合、検証結果を手動で拡張
      // 注: 将来的にc2pa-nodeがAPIで直接サポートするまでの暫定対応
      const result = await c2paInstance.read(fileAsset);

      if (result) {
        // データ構造をデバッグログとして出力
        console.log("C2PA読み取り結果のデータ構造:", 
          JSON.stringify({
            active_manifest_type: typeof result.active_manifest,
            active_manifest_label: result.active_manifest?.label,
            has_manifests: !!result.manifests,
            manifest_keys: Object.keys(result.manifests || {})
          }, null, 2)
        );

        // C2PAデータがある場合、フロントエンドの期待する形式に変換
        const transformedData = transformC2paDataForFrontend(result);
        
        res.json({
          success: true,
          hasC2pa: true,
          manifest: transformedData,
        });
      } else {
        // C2PAデータがない場合
        res.json({
          success: true,
          hasC2pa: false,
        });
      }
    } catch (readError) {
      // C2PA読み取りエラーをログに記録
      console.error('C2PA読み取りエラー:', readError);
      
      // エラーが発生した場合でもアプリケーションを継続させるため
      // C2PAデータがないとして処理
      res.json({
        success: true,
        hasC2pa: false,
        error: `C2PA読み取りエラー: ${readError instanceof Error ? readError.message : 'Unknown error'}`
      });
    }
  } catch (error) {
    console.error("リクエスト処理エラー:", error);
    
    res.status(500).json({
      success: false,
      error: "C2PAデータの読み取り中にエラーが発生しました。",
    });
  }
};

/**
 * C2PA情報の署名処理
 */
export const signC2pa = async (req: Request, res: Response): Promise<void> => {
  try {
    // リクエストボディを取得
    const { fileId, manifestData, certificate, privateKey, useLocalSigner } = req.body as SignData;

    // fileIdのバリデーション
    if (!fileId || !isValidFileId(fileId)) {
      res.status(400).json({
        success: false,
        error: "無効なファイルIDです。",
      });
      return;
    }

    // マニフェストデータのバリデーション
    if (!manifestData || typeof manifestData !== "object") {
      res.status(400).json({
        success: false,
        error: "無効なマニフェストデータです。",
      });
      return;
    }
    
    // ローカル署名の場合、証明書と秘密鍵のバリデーション
    if (useLocalSigner) {
      if (!certificate || !privateKey) {
        res.status(400).json({
          success: false,
          error: "ローカル署名には証明書と秘密鍵が必要です。",
        });
        return;
      }
    }

    // 一時ファイルのパスを取得
    const tempFilePath = getTempFilePath(fileId);

    // ファイルの存在チェック
    try {
      await fs.access(tempFilePath);
    } catch (error) {
      res.status(404).json({
        success: false,
        error: `指定されたファイルが見つかりません。: ${error}`,
      });
      return;
    }

    // ファイル拡張子を抽出
    const extension = path.extname(fileId);

    // 出力ファイル名を生成
    const outputFileName = `signed_${generateUniqueId()}${extension}`;
    const outputPath = path.join(config.tempDir, outputFileName);

    // MIMEタイプを拡張子から決定
    const mimeType = getMimeType(fileId);

    if (!mimeType) {
      res.status(400).json({
        success: false,
        error: "サポートされていないファイル形式です。",
      });
      return;
    }

    try {
      // 署名者の作成
      let signer;
      
      if (useLocalSigner && certificate && privateKey) {
        console.log("ローカル署名者を使用します");
        
        try {
          // PEMと秘密鍵の内容をバッファに変換
          const certificateBuffer = Buffer.from(certificate.content);
          const privateKeyBuffer = Buffer.from(privateKey.content);
          
          // ローカル署名者を作成
          signer = {
            type: 'local' as const,
            certificate: certificateBuffer,
            privateKey: privateKeyBuffer,
            algorithm: SigningAlgorithm.ES256,
            tsaUrl: 'http://timestamp.digicert.com',
          };
        } catch (err) {
          console.error("証明書または秘密鍵の処理エラー:", err);
          res.status(400).json({
            success: false,
            error: "証明書または秘密鍵の処理に失敗しました: " + (err instanceof Error ? err.message : String(err)),
          });
          return;
        }
      } else {
        console.log("テスト署名者を使用します");
        // テスト署名者を作成
        signer = await createTestSigner();
      }

      // C2PAインスタンスを署名者付きで作成
      const c2pa = createC2pa({ signer });

      // マニフェストビルダーを作成
      const manifest = new ManifestBuilder({
        claim_generator: manifestData.claimGenerator || "c2pa-web-app/1.0.0",
        format: manifestData.format || mimeType,
        title: manifestData.title,
      });

      // アサーションの追加
      if (manifestData.assertions && manifestData.assertions.length > 0) {
        // すべてのアサーションを追加
        for (const assertion of manifestData.assertions) {
          manifest.definition.assertions = manifest.definition.assertions || [];
          manifest.definition.assertions.push(assertion);
        }
      }

      // 追加メタデータの設定
      if (manifestData.creator) {
        manifest.definition.assertions = manifest.definition.assertions || [];
        manifest.definition.assertions.push({
          label: "dc.creator",
          data: { value: manifestData.creator },
        });
      }

      if (manifestData.copyright) {
        manifest.definition.assertions = manifest.definition.assertions || [];
        manifest.definition.assertions.push({
          label: "dc.rights",
          data: { value: manifestData.copyright },
        });
      }

      if (manifestData.description) {
        manifest.definition.assertions = manifest.definition.assertions || [];
        manifest.definition.assertions.push({
          label: "dc.description",
          data: { value: manifestData.description },
        });
      }

      // アセットを準備
      const asset: FileAsset = {
        path: tempFilePath,
        mimeType
      };

      try {
        // 署名を実行
        console.log("署名処理開始...");
        const result = await c2pa.sign({
          asset,
          manifest,
          options: {
            outputPath,
          }
        });

        // 一時出力ファイルの存在確認
        await fs.access(outputPath);

        // ダウンロードURLを生成
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const downloadUrl = `${baseUrl}/api/download?file=${outputFileName}`;

        res.json({
          success: true,
          fileId: outputFileName,
          downloadUrl,
        });
      } catch (signError) {
        console.error("署名実行エラー:", signError);
        
        // エラー内容を詳細に分析
        let errorMessage = "署名処理に失敗しました";
        if (signError instanceof Error) {
          errorMessage += ": " + signError.message;
          
          // 原因分析を追加
          if (signError.message.includes("PEM")) {
            errorMessage += "。証明書または秘密鍵のフォーマットが正しくない可能性があります。";
          } else if (signError.message.includes("private key")) {
            errorMessage += "。秘密鍵が無効または証明書と一致していない可能性があります。";
          }
        }
        
        res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    } catch (c2paError) {
      console.error("C2PAモジュール処理エラー:", c2paError);
      res.status(500).json({
        success: false,
        error: "C2PAモジュールの処理に失敗しました",
      });
    }
  } catch (error) {
    console.error("C2PA署名エラー:", error);
    
    res.status(500).json({
      success: false,
      error: "C2PA署名処理中にエラーが発生しました。",
    });
  }
};

/**
 * C2PA情報の検証処理
 */
export const verifyC2pa = async (req: Request, res: Response): Promise<void> => {
  try {
    // リクエストボディからfileIdを取得
    const { fileId } = req.body;

    // fileIdのバリデーション
    if (!fileId || !isValidFileId(fileId)) {
      res.status(400).json({
        success: false,
        error: "無効なファイルIDです。",
      });
      return;
    }

    // 一時ファイルのパスを取得
    const tempFilePath = getTempFilePath(fileId);

    // ファイルの存在チェック
    try {
      await fs.access(tempFilePath);
    } catch (error) {
      res.status(404).json({
        success: false,
        error: `指定されたファイルが見つかりません。: ${error}`,
      });
      return;
    }

    // MIMEタイプを取得
    const mimeType = getMimeType(fileId);

    if (!mimeType) {
      res.status(400).json({
        success: false,
        error: "サポートされていないファイル形式です。",
      });
      return;
    }

    try {
      // トラストリストオプションを取得（可能であれば）
      const trustOptions = await createC2paTrustOptions();
      
      // ファイルのC2PA情報を読み取る
      const fileAsset: FileAsset = { path: tempFilePath, mimeType };
      
      // 現在のc2pa-nodeバージョンではread()に設定を渡せないため
      // 標準の方法で読み取り、その後で証明書の検証を行う
      // トラストオプションが利用可能な場合、検証結果を手動で拡張
      // 注: 将来的にc2pa-nodeがAPIで直接サポートするまでの暫定対応
      const result = await c2paInstance.read(fileAsset);

      if (!result) {
        res.json({
          success: true,
          hasC2pa: false,
          isValid: false,
          validationDetails: {
            status: "invalid",
            errors: ["このファイルにはC2PA情報が含まれていません。"],
          },
        });
        return;
      }

      // 証明書の信頼性情報を抽出
      const certificateTrustInfo = extractCertificateTrustInfo(result);

      // C2PA情報から検証結果を抽出
      const validationResults = extractValidationResults(result, certificateTrustInfo);

      res.json({
        success: true,
        hasC2pa: true,
        ...validationResults
      });
    } catch (verifyError) {
      // C2PA検証エラーをログに記録
      console.error('C2PA検証エラー:', verifyError);
      
      res.json({
        success: true,
        hasC2pa: false,
        isValid: false,
        validationDetails: {
          status: "invalid",
          errors: ["C2PAデータの検証中にエラーが発生しました。"],
        },
      });
    }
  } catch (error) {
    console.error("リクエスト処理エラー:", error);
    
    res.status(500).json({
      success: false,
      error: "C2PAデータの検証中にエラーが発生しました。",
    });
  }
};

/**
 * C2PAの検証結果を詳細に抽出する関数
 */
function extractValidationResults(
  manifestStore: ResolvedManifestStore, 
  certificateTrustInfo?: any
) {
  // 検証ステータスの抽出
  const validationStatus = manifestStore.validation_status || "unknown";
  
  // 基本的な検証結果
  let isValid = validationStatus === "valid";
  let status = isValid ? "valid" : (validationStatus === "invalid" ? "invalid" : "warning");
  
  // エラーと警告を収集
  let errors: string[] = [];
  let warnings: string[] = [];

  // アクティブなマニフェストとその情報
  const activeManifest = manifestStore.active_manifest;
  const manifests = manifestStore.manifests || {};

  // 証明書信頼性情報の処理
  if (certificateTrustInfo) {
    // 証明書が信頼できない場合は警告を追加
    if (!certificateTrustInfo.isTrusted && certificateTrustInfo.errorMessage) {
      warnings.push(`証明書の信頼性: ${certificateTrustInfo.errorMessage}`);
    }
  }

  // マニフェストの検証情報を抽出
  const manifestValidations: any[] = [];
  Object.entries(manifests).forEach(([label, manifest]) => {
    // 各マニフェストの検証情報を収集
    const manifestInfo: any = {
      label,
      title: manifest.title || "不明なタイトル",
      isActive: activeManifest && activeManifest.label === label,
      signatureInfo: manifest.signature_info || null,
      validationDetails: []
    };

    // マニフェストの署名検証結果
    if (manifest.signature_info) {
      manifestInfo.signatureTime = manifest.signature_info.timeObject || manifest.signature_info.time;
      manifestInfo.signatureIssuer = manifest.signature_info.issuer || "不明な発行者";
    }

    // 明確なエラーパターンを検出して追加
    if (validationStatus === "invalid") {
      errors.push("C2PA署名が無効です。マニフェストまたは署名が改ざんされている可能性があります。");
    } else if (validationStatus !== "valid") {
      warnings.push("C2PA署名に警告があります。署名は有効ですが、一部の検証に問題があります。");
    }

    // マニフェストから具体的な警告を抽出
    if (manifest.validation_status && Array.isArray(manifest.validation_status)) {
      manifest.validation_status.forEach((vs: any) => {
        const detail = {
          code: vs.code || "unknown",
          explanation: vs.explanation || "詳細情報なし",
          url: vs.url || null
        };
        manifestInfo.validationDetails.push(detail);
        
        // 重大なエラーコードを検出
        if (detail.code.includes("invalid") || detail.code.includes("error")) {
          errors.push(detail.explanation);
        } 
        // 警告コードを検出
        else if (detail.code.includes("warning")) {
          warnings.push(detail.explanation);
        }
      });
    }

    // 材料（インクルードされたファイル）の検証
    if (manifest.ingredients && manifest.ingredients.length > 0) {
      const ingredientIssues: string[] = [];
      manifest.ingredients.forEach((ingredient, index) => {
        if (ingredient.validation_status && Array.isArray(ingredient.validation_status)) {
          ingredient.validation_status.forEach((vs: any) => {
            const issue = `材料 ${index + 1} (${ingredient.title || "不明"}): ${vs.explanation || vs.code || "検証エラー"}`;
            ingredientIssues.push(issue);
            
            // エラーと警告を分類
            if (vs.code && (vs.code.includes("invalid") || vs.code.includes("error"))) {
              errors.push(issue);
            } else {
              warnings.push(issue);
            }
          });
        }
      });
      
      if (ingredientIssues.length > 0) {
        manifestInfo.ingredientIssues = ingredientIssues;
      }
    }

    manifestValidations.push(manifestInfo);
  });

  // 署名タイムスタンプに関する検証
  const activeSignatureInfo = activeManifest?.signature_info;
  if (activeSignatureInfo) {
    const signatureDate = activeSignatureInfo.timeObject || 
      (activeSignatureInfo.time ? new Date(activeSignatureInfo.time) : null);
    
    if (!signatureDate) {
      warnings.push("署名にタイムスタンプが含まれていません。信頼性が低下する可能性があります。");
    } else {
      const now = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(now.getFullYear() - 1);
      
      if (signatureDate < oneYearAgo) {
        warnings.push("署名が1年以上前に作成されています。証明書が失効している可能性があります。");
      }
    }
  }

  // 詳細な検証情報を組み立て
  const validationDetails = {
    status,
    errors,
    warnings,
    manifestValidations,
    // 全体的なマニフェストストア情報
    manifestStore: {
      validationStatus,
      activeManifestLabel: activeManifest?.label || null,
      manifestsCount: Object.keys(manifests).length,
    },
    // アクティブマニフェストの詳細情報
    activeManifest: activeManifest ? {
      label: activeManifest.label,
      title: activeManifest.title,
      format: activeManifest.format,
      generator: activeManifest.claim_generator,
      signatureInfo: activeManifest.signature_info,
      assertionsCount: activeManifest.assertions?.length || 0,
      ingredientsCount: activeManifest.ingredients?.length || 0,
    } : null,
    // 証明書信頼性情報を追加
    certificateTrust: certificateTrustInfo || {
      isTrusted: false,
      issuer: null,
      timestamp: null,
      errorMessage: "証明書信頼性情報が利用できません"
    }
  };

  return {
    isValid,
    validationDetails
  };
}