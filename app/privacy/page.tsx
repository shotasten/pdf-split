import type { Metadata } from "next";
import Link from "next/link";
import SiteFrame from "../site-frame";

const title = "プライバシーポリシー｜PDF見開き分割くん";
const description =
  "PDF見開き分割くんのプライバシーポリシー。PDF処理はブラウザ内で完結し、アップロードしたPDFはサーバーには送信されません。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/privacy"
  },
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    title,
    description,
    url: "/privacy",
    siteName: "PDF見開き分割くん",
    type: "article",
    locale: "ja_JP"
  },
  twitter: {
    card: "summary",
    title,
    description
  }
};

export default function PrivacyPage() {
  return (
    <SiteFrame>
      <section className="privacy-shell">
        <article className="privacy-card">
          <Link className="privacy-back" href="/">← PDF見開き分割くんへ戻る</Link>
          <h1>プライバシーポリシー</h1>
          <p className="privacy-lead">
          PDF見開き分割くんは、PDFのプレビューと分割処理をブラウザ内で行います。
          選択したPDFファイルはサーバーには送信されません。
          </p>

          <section>
          <h2>PDFファイルの取り扱い</h2>
          <p>
            本サービスでは、PDFの読み込み、プレビュー、分割PDFの作成を利用者のブラウザ内で実行します。
            パスワード付きPDFで入力したパスワードを含め、PDFファイルの内容を当サイトのサーバーへアップロード、保存、解析することはありません。
          </p>
          </section>

          <section>
          <h2>アクセス解析・広告について</h2>
          <p>
            本サービスでは、サービス改善のために Google Analytics を利用する場合があります。
            Google Analytics はCookieなどを利用してアクセス状況を計測しますが、利用者が選択したPDFファイルの内容を取得することはありません。
          </p>
          <p>
            また、本サービスでは Google AdSense による広告配信を行う場合があります。
            Google AdSense はCookieなどを利用して広告を配信する場合がありますが、利用者が選択したPDFファイルの内容を取得することはありません。
          </p>
          </section>

          <section>
          <h2>お知らせ</h2>
          <p>
            本ポリシーの内容は、必要に応じて変更する場合があります。変更後の内容は本ページに掲載します。
          </p>
          </section>
        </article>
      </section>
    </SiteFrame>
  );
}
