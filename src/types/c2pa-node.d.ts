declare module 'c2pa-node' {
    // インターフェースの定義
    export interface BufferAsset {
      buffer: Buffer;
      mimeType: string;
    }
  
    export interface FileAsset {
      path: string;
      mimeType?: string;
    }
  
    export type Asset = BufferAsset | FileAsset;
  
    export interface ResourceRef {
      format: string;
      identifier: string;
    }
  
    export interface SignatureInfo {
      issuer?: string | null;
      time?: string | null;
      timeObject?: Date | null;
      [key: string]: any;
    }
  
    export interface ResolvedResource {
      format: string;
      data: Buffer | null;
    }
  
    export interface ResolvedIngredient {
      title: string;
      manifest: any | null;
      thumbnail: ResolvedResource | null;
      [key: string]: any;
    }
  
    export interface ValidationStatus {
      code: string;
      explanation?: string | null;
      url?: string | null;
    }
  
    export interface ResolvedManifest {
      claim_generator?: string;
      format?: string;
      title?: string | null;
      assertions?: any[];
      ingredients: ResolvedIngredient[];
      thumbnail: ResolvedResource | null;
      signature_info?: SignatureInfo | null;
      label?: string | null;
      validation_status?: ValidationStatus[] | null;
      [key: string]: any;
    }
  
    export interface ResolvedManifestStore {
      active_manifest: ResolvedManifest | null;
      manifests: Record<string, ResolvedManifest>;
      validation_status: string | ValidationStatus[] | null;
    }
  
    export interface C2pa {
      read(asset: Asset): Promise<ResolvedManifestStore | null>;
      createIngredient(props: any): Promise<any>;
      sign(props: any): Promise<any>;
    }
  
    export interface ManifestBuilderOptions {
      vendor?: string;
    }
  
    export interface ManifestBuilder {
      definition: any;
      addIngredient(ingredient: any): ManifestBuilder;
      addThumbnail(thumbnail: BufferAsset): Promise<void>;
      asSendable(): any;
    }
  
    export class ManifestBuilder {
      constructor(baseDefinition: any, options?: ManifestBuilderOptions);
      static createLabel(vendor?: string): string;
    }
  
    export enum SigningAlgorithm {
      ES256 = 'es256',
      ES384 = 'es384',
      ES512 = 'es512',
      PS256 = 'ps256',
      PS384 = 'ps384',
      PS512 = 'ps512',
      Ed25519 = 'ed25519'
    }
  
    export interface LocalSigner {
      type: 'local';
      certificate: Buffer;
      privateKey: Buffer;
      algorithm?: SigningAlgorithm;
      tsaUrl?: string;
    }
  
    export interface RemoteSigner {
      type: 'remote';
      reserveSize: () => Promise<number>;
      sign: (input: any) => Promise<Buffer>;
    }
  
    export type Signer = LocalSigner | RemoteSigner;
  
    export interface C2paOptions {
      signer?: Signer;
      thumbnail?: any | false | null;
      ingredientHashAlgorithm?: string;
    }
  
    export function createC2pa(options?: C2paOptions): C2pa;
    export function createTestSigner(options?: any): Promise<LocalSigner>;
  }