# C2PA対応画像処理Webアプリケーション (バックエンド)

![C2PA対応画像処理Webアプリケーション](https://via.placeholder.com/800x400?text=C2PA+Backend+API)

**リポジトリ**: [https://github.com/yhayano-ponotech/c2pa-authentipic-backend](https://github.com/yhayano-ponotech/c2pa-authentipic-backend)

> **重要**: このバックエンドサーバーは対応するフロントエンドアプリケーションと組み合わせて使用することを想定しています。フロントエンドリポジトリは[https://github.com/yhayano-ponotech/c2pa-authentipic-frontend](https://github.com/yhayano-ponotech/c2pa-authentipic-frontend)からアクセスできます。

## 📋 プロジェクト概要

このバックエンドサーバーは、C2PA（Coalition for Content Provenance and Authenticity）対応の画像処理Webアプリケーションのバックエンドとして機能します。画像ファイルのアップロード、C2PA情報の読み取り・追加・検証などのAPIを提供します。

### 主な機能

- **画像ファイルの管理**: アップロード、一時保存、提供
- **C2PA情報の読み取り**: 画像からC2PA情報を抽出
- **C2PA情報の追加**: 画像にC2PA情報を追加してデジタル署名
- **C2PA情報の検証**: 画像のC2PA署名の検証と証明書の信頼性確認
- **証明書信頼リストの管理**: C2PA信頼リストの自動更新

## 🚀 技術スタック

- **実行環境**: [Node.js](https://nodejs.org/)
- **言語**: [TypeScript](https://www.typescriptlang.org/)
- **フレームワーク**: [Express](https://expressjs.com/)
- **C2PA処理**: [c2pa-node](https://github.com/contentauth/c2pa-node)
- **ファイル処理**: [Multer](https://github.com/expressjs/multer)
- **画像処理**: [Sharp](https://sharp.pixelplumbing.com/)
- **セキュリティ**: [Helmet](https://helmetjs.github.io/)

## 🛠️ 開発環境のセットアップ

### 前提条件

- [Node.js](https://nodejs.org/) 18.0.0以上
- [npm](https://www.npmjs.com/) または [yarn](https://yarnpkg.com/) または [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (c2pa-nodeの依存関係)

### インストール手順

1. リポジトリをクローンします：

```bash
git clone https://github.com/yourusername/c2pa-web-app-backend.git
cd c2pa-web-app-backend
```

2. 依存パッケージをインストールします：

```bash
npm install
# または
yarn install
# または
pnpm install
```

3. 環境変数を設定します。プロジェクトのルートに `.env` ファイルを作成し、以下の内容を追加します：

```
PORT=3001
CORS_ORIGIN=http://localhost:3000
TEMP_DIR=./tmp/c2pa-web-app-temp
ENABLE_TRUST_LIST=true
ADMIN_TOKEN=your_admin_token_here
```

4. 開発サーバーを起動します：

```bash
npm run dev
# または
yarn dev
# または
pnpm dev
```

5. サーバーが正常に起動すると、`http://localhost:3001` でAPIが利用可能になります。

## 📁 プロジェクト構造

```
src/
├── config/           # 設定ファイル
│   └── index.ts      # メイン設定
├── controllers/      # APIコントローラー
│   ├── c2paController.ts   # C2PA関連処理
│   ├── fileController.ts   # ファイル管理処理
│   └── trustController.ts  # 証明書信頼リスト処理
├── middlewares/      # ミドルウェア
│   └── upload.ts     # ファイルアップロード処理
├── routes/           # APIルート定義
│   ├── c2paRoutes.ts  # C2PA関連エンドポイント
│   ├── fileRoutes.ts  # ファイル関連エンドポイント
│   └── trustRoutes.ts # 信頼リスト関連エンドポイント
├── services/         # サービス
│   └── trustListService.ts # 証明書信頼リスト管理
├── types/            # 型定義
│   └── index.ts      # 共通型定義
├── utils/            # ユーティリティ関数
│   ├── c2paUtils.ts  # C2PA処理ユーティリティ
│   ├── fileUtils.ts  # ファイル処理ユーティリティ
│   └── trustListUtils.ts # 信頼リスト処理ユーティリティ
└── server.ts         # サーバーエントリーポイント
```

## 📡 APIエンドポイント

### C2PA関連

- **POST /api/c2pa/upload** - 画像ファイルのアップロード
  - リクエスト: `multipart/form-data` (フィールド名: `file`)
  - レスポンス: `{ success: true, fileId, fileName, fileType, fileSize, url }`

- **POST /api/c2pa/read** - C2PA情報の読み取り
  - リクエスト: `{ fileId: string }`
  - レスポンス: `{ success: true, hasC2pa: boolean, manifest?: object }`

- **POST /api/c2pa/sign** - C2PA情報の追加・署名
  - リクエスト: `{ fileId: string, manifestData: object }`
  - レスポンス: `{ success: true, fileId: string, downloadUrl: string }`

- **POST /api/c2pa/verify** - C2PA情報の検証
  - リクエスト: `{ fileId: string }`
  - レスポンス: `{ success: true, hasC2pa: boolean, isValid: boolean, validationDetails: object }`

### ファイル関連

- **GET /api/temp/:filename** - 一時ファイルへのアクセス
  - レスポンス: ファイルのバイナリデータ

- **GET /api/download** - 署名済みファイルのダウンロード
  - クエリ: `?file=filename`
  - レスポンス: ファイルのバイナリデータ（`Content-Disposition: attachment`）

### 証明書信頼リスト関連

- **GET /api/trust/status** - 証明書トラストリストの状態を取得
  - レスポンス: `{ success: true, enabled: boolean, available: boolean, lastUpdated: string, ... }`

- **POST /api/trust/update** - 証明書トラストリストを手動で更新（管理者用）
  - ヘッダー: `X-Admin-Token: your_admin_token`
  - レスポンス: `{ success: true, message: string, status: object }`

## 🏢 C2PA信頼リストについて

このアプリケーションは、[Content Credentials](https://contentcredentials.org/trust)が提供する証明書信頼リストを使用して、C2PA署名の信頼性を検証します。信頼リストは以下のファイルで構成されています：

- `allowed.pem` - 許可された証明書のリスト
- `allowed.sha256.txt` - 許可された証明書のハッシュ値
- `anchors.pem` - 信頼のルートとなるアンカー証明書
- `store.cfg` - 証明書ストアの設定

これらのファイルは自動的にダウンロードされ、定期的に更新されます。更新間隔は `config/index.ts` で設定できます。

## 🌐 Renderへのデプロイ方法

このバックエンドサーバーは[Render](https://render.com/)に簡単にデプロイできます。

### 手順

1. [Render](https://render.com/)にアカウント登録し、ログインします。

2. ダッシュボードから「New +」→「Web Service」をクリックします。

3. GitHubリポジトリ（[https://github.com/yhayano-ponotech/c2pa-authentipic-backend](https://github.com/yhayano-ponotech/c2pa-authentipic-backend)）をインポートします（リポジトリへのアクセス権限を与える必要があります）。

4. 以下の設定を行います：
   - **Name**: 任意のサービス名（例：`c2pa-authentipic-backend`）
   - **Environment**: Node
   - **Region**: 近い地域を選択
   - **Branch**: main（または使用するブランチ）
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

5. 「Advanced」を開き、以下の環境変数を追加します：
   - `PORT`: `10000`（Renderは内部で10000ポートを使用）
   - `CORS_ORIGIN`: フロントエンドのURL（例：`https://c2pa-authentipic.vercel.app`）
   - `TEMP_DIR`: `/tmp/c2pa-web-app-temp`
   - `ENABLE_TRUST_LIST`: `true`
   - `ADMIN_TOKEN`: 任意の管理者トークン（安全な値を使用）

   > **重要**: `CORS_ORIGIN` には、対応するフロントエンドアプリケーションのデプロイURLを正確に設定してください。フロントエンドのデプロイ方法は[フロントエンドリポジトリのREADME](https://github.com/yhayano-ponotech/c2pa-authentipic-frontend)を参照してください。

6. 「Create Web Service」ボタンをクリックしてデプロイを開始します。

7. デプロイが完了したら、生成されたURLをメモし、フロントエンド側の `NEXT_PUBLIC_API_BASE_URL` 環境変数に設定してください（例：`https://c2pa-authentipic-backend.onrender.com/api`）。

### 永続ストレージの設定（オプション）

Renderの無料プランではファイルシステムは一時的なものです。永続的なファイルストレージが必要な場合は、以下のいずれかを検討してください：

1. **ディスク**（有料プラン）: Renderのディスク機能を有効にし、環境変数 `TEMP_DIR` をディスクのパスに設定します。

2. **クラウドストレージ**: AWS S3やGoogle Cloud Storageなどを使用し、コードを修正して一時ファイルをクラウドに保存するようにします。

3. **データベース**: 小さなファイルの場合、データベースにバイナリデータとして保存することも可能です。

### 注意事項

- Renderでは、インアクティブな状態が続くと無料プランのサービスはスリープします。初回アクセス時に起動に時間がかかる場合があります。
- c2pa-nodeライブラリはRustを使用しており、ビルドプロセスに時間がかかる場合があります。
- Renderの無料プランではリソースが制限されるため、大量のリクエストや大きなファイルの処理に制約がある場合があります。

## 🔄 フロントエンドとの連携

このバックエンドサーバーは、対応するフロントエンドアプリケーション（[https://github.com/yhayano-ponotech/c2pa-authentipic-frontend](https://github.com/yhayano-ponotech/c2pa-authentipic-frontend)）と組み合わせて使用することを想定しています。**バックエンド単体では完全な機能を提供しません**。

### 連携の設定方法

1. **CORS設定**: バックエンドサーバーは、フロントエンドアプリケーションとCORS（Cross-Origin Resource Sharing）設定により連携します。環境変数 `CORS_ORIGIN` で許可するフロントエンドのURLを指定してください。

   ```
   # ローカル開発環境の例
   CORS_ORIGIN=http://localhost:3000
   
   # 本番環境の例
   CORS_ORIGIN=https://your-c2pa-app.vercel.app
   ```

2. **フロントエンド側の設定**: フロントエンドアプリケーションは環境変数 `NEXT_PUBLIC_API_BASE_URL` でこのバックエンドのURLを指定する必要があります。

   ```
   # ローカル開発環境の例
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
   
   # 本番環境の例
   NEXT_PUBLIC_API_BASE_URL=https://your-c2pa-backend.onrender.com/api
   ```

フロントエンドとバックエンドを適切に連携させるには、両方のリポジトリをセットアップし、上記の設定を正しく行う必要があります。

## 📚 関連リソース

- [C2PA（Coalition for Content Provenance and Authenticity）](https://c2pa.org/)
- [c2pa-node ライブラリ](https://github.com/contentauth/c2pa-node)
- [Content Credentials 信頼リスト](https://contentcredentials.org/trust)
- [Express ドキュメント](https://expressjs.com/)

## 🤝 貢献方法

プロジェクトへの貢献を歓迎します。以下の手順に従ってください：

1. このリポジトリをフォークします。
2. 新しいブランチを作成します：`git checkout -b feature/your-feature-name`
3. 変更をコミットします：`git commit -m 'Add some feature'`
4. フォークにプッシュします：`git push origin feature/your-feature-name`
5. プルリクエストを作成します。

## 📄 ライセンス

[MIT License](LICENSE)

## 👥 作者

PONOTECH