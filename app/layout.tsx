import type { Metadata } from "next";
import "./globals.css";

const title = "PDF見開き分割くん｜ブラウザで左右・上下にPDF分割";
const description = "見開きPDFをブラウザ内で左右または上下に分割する無料Webアプリ。PDFはサーバーに送信されず、分割位置と出力順を指定できます。";

export const metadata: Metadata = {
  metadataBase: new URL("https://pdfsplit.shotaste.com"),
  title,
  description,
  manifest: "/site.webmanifest",
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "PDF見開き分割くん",
    type: "website",
    images: [
      {
        url: "/social-card.png",
        width: 1200,
        height: 630,
        alt: "PDF見開き分割くんのソーシャルカード"
      },
      {
        url: "/social-card.svg",
        width: 1200,
        height: 630,
        alt: "PDF見開き分割くんのソーシャルカード"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/social-card.png", "/social-card.svg"]
  },
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" }
    ],
    shortcut: "/icons/favicon-32x32.png",
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
