// C2PAマニフェスト関連の型定義

export interface C2paAssertion {
  label: string;
  data: Record<string, unknown>;
}

export interface C2paAction {
  action: string;
  when?: string;
  [key: string]: unknown;
}

export interface C2paIngredient {
  title: string;
  format?: string;
  instanceId?: string;
  documentId?: string;
  relationship?: string;
  validationData?: unknown;
  [key: string]: unknown;
}

export interface C2paManifest {
  claim_generator: string;
  format: string;
  title: string;
  assertions: C2paAssertion[];
  ingredients?: C2paIngredient[];
  signature?: {
    type: string;
    certificate: string;
    timestamp?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface C2paManifestData {
  active_manifest: string;
  manifests: Record<string, C2paManifest>;
  validation_status: string;
  validation_errors?: string[];
  validation_warnings?: string[];
  [key: string]: unknown;
}

// 画像メタデータの型
export interface AssetMetadata {
  name: string;
  size: number;
  mimeType: string;
  lastModified: number;
  [key: string]: unknown;
}

// 署名データの型
export interface SignData {
  fileId: string;
  manifestData: {
    title: string;
    creator?: string;
    copyright?: string;
    description?: string;
    claimGenerator: string;
    format?: string;
    assertions: C2paAssertion[];
    [key: string]: unknown;
  };
  certificate?: {
    content: string;
    name: string;
  };
  privateKey?: {
    content: string;
    name: string;
  };
  useLocalSigner?: boolean;
}

// 検証結果の型
export interface VerificationResult {
  isValid: boolean;
  status: string;
  details?: Record<string, unknown>;
  errors?: string[];
  warnings?: string[];
}

// アップロードファイル情報の型
export interface UploadedFileInfo {
  id: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  expiresAt: Date;
}

// リソース参照の型
export interface ResourceRef {
  format: string;
  identifier: string;
}

// C2PA署名設定の型
export interface SigningConfig {
  algorithmName: string;
  tsaUrl?: string;
  useTrustStore?: boolean;
}

// C2PAマニフェストビルダーのオプション型
export interface ManifestBuilderOptions {
  vendor?: string;
  includeCreatedAction?: boolean;
  includeThumbnail?: boolean;
}