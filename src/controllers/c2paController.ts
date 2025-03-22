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
import { SignData } from '../types';
import { 
  createC2pa, 
  createTestSigner, 
  ManifestBuilder, 
  SigningAlgorithm, 
  BufferAsset, 
  FileAsset,
  ResolvedManifestStore
} from 'c2pa-node';

// シングルトンC2PAインスタンスの作成
const c2paInstance = createC2pa();

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
      const fileAsset: FileAsset = { path: tempFilePath, mimeType };
      const result = await c2paInstance.read(fileAsset);

      if (result) {
        // C2PAデータがある場合
        res.json({
          success: true,
          hasC2pa: true,
          manifest: result,
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
      // ファイルのC2PA情報を読み取る
      const fileAsset: FileAsset = { path: tempFilePath, mimeType };
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

      // C2PA情報から検証結果を抽出
      const validationResults = extractValidationResults(result);

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
function extractValidationResults(manifestStore: ResolvedManifestStore) {
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
    } : null
  };

  return {
    isValid,
    validationDetails
  };
}