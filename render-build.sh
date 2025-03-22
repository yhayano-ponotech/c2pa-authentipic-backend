#!/usr/bin/env bash
# Render.com用ビルドスクリプト

# 依存関係のインストール
npm install

# TypeScriptをコンパイル
npm run build

# ビルド成功メッセージ
echo "Build completed successfully!"