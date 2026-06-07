# PDF見開き分割くん

見開きPDFをブラウザ内で左右または上下に分割し、分割後PDFをダウンロードするMVPです。PDFのプレビューと生成処理はサーバーへ送信せず、ブラウザ内で完結します。

## 機能

- PDFアップロード（ファイル選択 / ドラッグ&ドロップ）
- 1ページ目プレビュー
- 左右分割 / 上下分割の選択
- 50%を初期値にした分割位置調整
- 出力順の選択
- 分割後PDFのダウンロード

## 開発

```bash
npm install
npm run dev
```

ローカルURL: http://localhost:3000

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `out`
- Framework preset: Next.js または None

このプロジェクトは `next.config.ts` で `output: "export"` を指定しているため、静的サイトとして公開できます。
