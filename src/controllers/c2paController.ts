import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { 
  isValidFileId, 
  getTempFilePath, 
  getMimeType, 
  generateUniqueId 
} from '../utils/fileUtils';
import { loadC2pa } from '../utils/c2paUtils';
import { config } from '../config';
import { SignData } from '../types';

/**
 * ファイルアップロード処理
 */
export const uploadFile = async (req: Request, res: Response) => {
  try {
    // ファイルが添付されているか確認
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "ファイルがアップロードされていません。",
      });
    }

    const file = req.file;
    
    // ファイル名をサニタイズしてメタデータを作成
    const sanitizedFileName = path.basename(file.originalname);
    const fileId = path.basename(file.path);
    
    // ファイルのURLを生成
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/api/temp/${fileId}`;

    // 成功レスポンスを返す
    return res.status(200).json({
      success: true,
      fileId,
      fileName: sanitizedFileName,
      fileType: file.mimetype,
      fileSize: file.size,
      url: fileUrl,
    });
  } catch (error) {
    console.error("ファイルアップロードエラー:", error);
    
    return res.status(500).json({
      success: false,
      error: "ファイルのアップロード中にエラーが発生しました。",
    });
  }
};

/**
 * C2PA情報読み取り処理
 */
export const readC2pa = async (req: Request, res: Response) => {
  try {
    // リクエストボディからfileIdを取得
    const { fileId } = req.body;

    // fileIdのバリデーション
    if (!fileId || !isValidFileId(fileId)) {
      return res.status(400).json({
        success: false,
        error: "無効なファイルIDです。",
      });
    }

    // 一時ファイルのパスを取得
    const tempFilePath = getTempFilePath(fileId);

    // ファイルの存在チェック
    try {
      await fs.access(tempFilePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: `指定されたファイルが見つかりません。: ${error}`,
      });
    }

    // MIMEタイプを取得
    const mimeType = getMimeType(fileId);

    if (!mimeType) {
      return res.status(400).json({
        success: false,
        error: "サポートされていないファイル形式です。",
      });
    }

    try {
      // C2PAモジュールを動的にロード
      const { createC2pa } = await loadC2pa();
      
      // C2PAインスタンスを作成
      const c2pa = createC2pa();

      try {
        // ファイルパスを使用してC2PAデータを読み込み
        const result = await c2pa.read({ path: tempFilePath, mimeType });

        if (result && typeof result === 'object') {
          // C2PAデータがある場合
          const manifestData = {
            active_manifest: result.active_manifest || '',
            manifests: result.manifests || {},
            validation_status: result.validation_status || 'unknown',
            validation_errors: result.validation_errors || [],
            validation_warnings: result.validation_warnings || []
          };

          return res.json({
            success: true,
            hasC2pa: true,
            manifest: manifestData,
          });
        } else {
          // C2PAデータがない場合
          return res.json({
            success: true,
            hasC2pa: false,
          });
        }
      } catch (readError) {
        // C2PA読み取りエラーをログに記録
        console.error('C2PA読み取りエラー:', readError);
        
        // エラーが発生した場合でもアプリケーションを継続させるため
        // C2PAデータがないとして処理
        return res.json({
          success: true,
          hasC2pa: false,
        });
      }
    } catch (c2paError) {
      console.error("C2PAモジュール処理エラー:", c2paError);
      return res.status(500).json({
        success: false,
        error: "C2PAモジュールの処理に失敗しました",
      });
    }
  } catch (error) {
    console.error("リクエスト処理エラー:", error);
    
    return res.status(500).json({
      success: false,
      error: "C2PAデータの読み取り中にエラーが発生しました。",
    });
  }
};

/**
 * C2PA情報の署名処理
 */
export const signC2pa = async (req: Request, res: Response) => {
  try {
    // リクエストボディを取得
    const { fileId, manifestData, certificate, privateKey, useLocalSigner } = req.body as SignData;

    // fileIdのバリデーション
    if (!fileId || !isValidFileId(fileId)) {
      return res.status(400).json({
        success: false,
        error: "無効なファイルIDです。",
      });
    }

    // マニフェストデータのバリデーション
    if (!manifestData || typeof manifestData !== "object") {
      return res.status(400).json({
        success: false,
        error: "無効なマニフェストデータです。",
      });
    }
    
    // ローカル署名の場合、証明書と秘密鍵のバリデーション
    if (useLocalSigner) {
      if (!certificate || !privateKey) {
        return res.status(400).json({
          success: false,
          error: "ローカル署名には証明書と秘密鍵が必要です。",
        });
      }
    }

    // 一時ファイルのパスを取得
    const tempFilePath = getTempFilePath(fileId);

    // ファイルの存在チェック
    try {
      await fs.access(tempFilePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: `指定されたファイルが見つかりません。: ${error}`,
      });
    }

    // ファイル拡張子を抽出
    const extension = path.extname(fileId);

    // 出力ファイル名を生成
    const outputFileName = `signed_${generateUniqueId()}${extension}`;
    const outputPath = path.join(config.tempDir, outputFileName);

    // MIMEタイプを拡張子から決定
    const mimeType = getMimeType(extension);

    if (!mimeType) {
      return res.status(400).json({
        success: false,
        error: "サポートされていないファイル形式です。",
      });
    }

    try {
      // C2PAモジュールを動的にロード
      const { createC2pa, createTestSigner, ManifestBuilder, SigningAlgorithm } = await loadC2pa();

      // 署名者の作成
      let signer;
      
      if (useLocalSigner && certificate && privateKey) {
        console.log("ローカル署名者を使用します");
        
        try {
          // PEMと秘密鍵の内容をそのままバッファに変換
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
          return res.status(400).json({
            success: false,
            error: "証明書または秘密鍵の処理に失敗しました: " + (err instanceof Error ? err.message : String(err)),
          });
        }
      } else {
        console.log("テスト署名者を使用します");
        // テスト署名者を作成
        signer = await createTestSigner();
      }

      // C2PAインスタンスを作成
      const c2pa = createC2pa({ signer });

      // 基本アサーションの準備
      const assertions = manifestData.assertions ? [...manifestData.assertions] : [];

      // 追加メタデータがあれば設定
      if (manifestData.creator) {
        assertions.push({
          label: "dc.creator",
          data: manifestData.creator,
        });
      }

      if (manifestData.copyright) {
        assertions.push({
          label: "dc.rights",
          data: manifestData.copyright,
        });
      }

      if (manifestData.description) {
        assertions.push({
          label: "dc.description",
          data: manifestData.description,
        });
      }

      // マニフェストビルダーを作成
      const manifest = new ManifestBuilder({
        claim_generator: manifestData.claimGenerator || "c2pa-web-app/1.0.0",
        format: manifestData.format || mimeType,
        title: manifestData.title,
        assertions: assertions,
      });

      // アセットを準備 - ファイルパスを使用
      const asset = {
        path: tempFilePath,
      };

      try {
        // 署名を実行
        console.log("署名処理開始...");
        const result = await c2pa.sign({
          asset,
          manifest,
          options: {
            outputPath,
          },
        });

        // 一時出力ファイルの存在確認
        await fs.access(outputPath);

        // ダウンロードURLを生成
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const downloadUrl = `${baseUrl}/api/download?file=${outputFileName}`;

        return res.json({
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
        
        return res.status(500).json({
          success: false,
          error: errorMessage,
        });
      }
    } catch (c2paError) {
      console.error("C2PAモジュール処理エラー:", c2paError);
      return res.status(500).json({
        success: false,
        error: "C2PAモジュールの処理に失敗しました",
      });
    }
  } catch (error) {
    console.error("C2PA署名エラー:", error);
    
    return res.status(500).json({
      success: false,
      error: "C2PA署名処理中にエラーが発生しました。",
    });
  }
};

/**
 * C2PA情報の検証処理
 */
export const verifyC2pa = async (req: Request, res: Response) => {
  try {
    // リクエストボディからfileIdを取得
    const { fileId } = req.body;

    // fileIdのバリデーション
    if (!fileId || !isValidFileId(fileId)) {
      return res.status(400).json({
        success: false,
        error: "無効なファイルIDです。",
      });
    }

    // 一時ファイルのパスを取得
    const tempFilePath = getTempFilePath(fileId);

    // ファイルの存在チェック
    try {
      await fs.access(tempFilePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: `指定されたファイルが見つかりません。: ${error}`,
      });
    }

    // MIMEタイプを取得
    const mimeType = getMimeType(fileId);

    if (!mimeType) {
      return res.status(400).json({
        success: false,
        error: "サポートされていないファイル形式です。",
      });
    }

    try {
      // C2PAモジュールを動的にロード
      const { createC2pa } = await loadC2pa();
      
      // C2PAインスタンスを作成
      const c2pa = createC2pa();

      try {
        // ファイルパスを使用してC2PAデータを読み込み
        const result = await c2pa.read({ path: tempFilePath, mimeType });

        if (!result) {
          return res.json({
            success: true,
            hasC2pa: false,
            isValid: false,
            validationDetails: {
              status: "invalid",
              errors: ["このファイルにはC2PA情報が含まれていません。"],
            },
          });
        }

        // 検証ステータスに基づいて結果を生成
        const { validation_status } = result;
        
        let isValid = false;
        let status = "invalid";
        let errors: string[] = [];
        let warnings: string[] = [];
        
        if (validation_status === "valid") {
          isValid = true;
          status = "valid";
        } else if (validation_status === "invalid") {
          // 具体的なエラー情報を抽出
          errors.push("C2PA署名が無効です。");
          if (result.validation_errors) {
            if (Array.isArray(result.validation_errors)) {
              errors = errors.concat(result.validation_errors);
            }
          }
        } else {
          // 警告がある場合
          status = "warning";
          warnings.push("C2PA署名に警告があります。");
          if (result.validation_warnings) {
            if (Array.isArray(result.validation_warnings)) {
              warnings = warnings.concat(result.validation_warnings);
            }
          }
        }

        // 検証の詳細情報を生成
        const details = {
          validationType: validation_status,
          activeManifest: result.active_manifest,
          // その他の検証詳細情報があれば追加
        };

        return res.json({
          success: true,
          hasC2pa: true,
          isValid,
          validationDetails: {
            status,
            details,
            errors,
            warnings,
          },
        });
      } catch (verifyError) {
        // C2PA検証エラーをログに記録
        console.error('C2PA検証エラー:', verifyError);
        
        return res.json({
          success: true,
          hasC2pa: false,
          isValid: false,
          validationDetails: {
            status: "invalid",
            errors: ["C2PAデータの検証中にエラーが発生しました。"],
          },
        });
      }
    } catch (c2paError) {
      console.error("C2PAモジュール処理エラー:", c2paError);
      return res.status(500).json({
        success: false,
        error: "C2PAモジュールの処理に失敗しました",
      });
    }
  } catch (error) {
    console.error("リクエスト処理エラー:", error);
    
    return res.status(500).json({
      success: false,
      error: "C2PAデータの検証中にエラーが発生しました。",
    });
  }
};
