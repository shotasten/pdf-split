# CLAUDE.md

## プロジェクト概要

PDF見開き分割くんは、見開きPDFを左右または上下に分割するブラウザ向けWebアプリです。PDFのプレビューは `pdfjs-dist`、分割後PDFの生成は `pdf-lib` が担当します。

PDFの読み込み、プレビュー、分割PDFの作成はブラウザ内で完結させる方針です。PDFをサーバーへ送る仕様に変える場合は、実装だけでなくドキュメントとプライバシーポリシーも見直してください。

## まず見るファイル

- [README.md](README.md)
- [docs/spec.md](docs/spec.md)
- [app/pdf-split-app.tsx](app/pdf-split-app.tsx)

READMEで全体像をつかみ、細かい挙動は `docs/spec.md` を確認してください。PDF分割の実装は `app/pdf-split-app.tsx` にまとまっています。

## 変更時のルール

- コードを修正したら、README、`docs/spec.md`、プライバシーポリシーなどのドキュメント更新が漏れていないか必ず確認する
- 仕様、UI文言、操作フロー、PDF処理、プライバシーに関わる変更を入れた場合は、該当するドキュメントも更新する
- `main` への直pushは禁止
- 特別な指示がない限り、最新の `main` から作業ブランチを切って変更し、Pull Requestを作成する
- GitHub上に残るコミットメッセージ、Pull Request、Issue、コメントは日本語で書く
- 機能改修後は `npm run dev` で画面を確認し、ユーザーにも動作確認を促す

## 確認コマンド

変更後は、少なくとも次を確認してください。

```bash
npm run lint
npm run build
npm run dev
```

`npm run dev` は、機能改修後の画面確認に使います。起動後は、変更した操作をユーザーにも確認してもらうよう案内してください。
