# PDF見開き分割くん

見開きPDFを左右または上下に分割するブラウザ向けツールです。PDFの読み込み、プレビュー、分割PDFの作成はブラウザ内で行います。選択したPDFをアプリケーション側のサーバーへ送る前提ではありません。

## できること

- PDFファイルを選択、またはドラッグアンドドロップで読み込む
- 読み込んだPDFをページ送り付きでプレビューする
- 左右分割、上下分割を切り替える
- 分割位置を20%から80%の範囲で調整する
- 出力順を左から、右から、上から、下から選ぶ
- 分割したPDFを `元ファイル名-split.pdf` としてダウンロードする

## 仕組み

プレビューは `pdfjs-dist`、PDFの生成は `pdf-lib` を使っています。

分割時は元ページを2回複製し、それぞれの `MediaBox`、`CropBox`、`BleedBox`、`TrimBox`、`ArtBox` を分割範囲に合わせて設定します。ページ内容をラスタライズしないため、元PDFが持つベクター情報やテキスト情報はPDFライブラリが扱える範囲で残ります。

## セットアップ

```bash
npm install
```

## よく使うコマンド

```bash
npm run dev
npm run build
npm run lint
```

## ディレクトリ

```text
app/
  layout.tsx          サイト全体のメタデータ
  page.tsx            トップページ
  pdf-split-app.tsx   PDF分割ツール本体
  privacy/page.tsx    プライバシーポリシー
public/
  assets/             ロゴ、キャラクター画像
  icons/              favicon、PWA用アイコン
scripts/
  generate-icons.mjs
  generate-social-card.mjs
docs/
  spec.md             仕様メモ
```

## 仕様

詳しい仕様は [docs/spec.md](docs/spec.md) を参照してください。

## 注意点

- パスワード付きPDFや破損したPDFは処理できない場合があります。
- PDFの構造によっては、元PDFの見た目やメタデータを完全には引き継げない場合があります。
- 大きなPDFはブラウザのメモリ使用量が増えます。
