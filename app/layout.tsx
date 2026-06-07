import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const title = "PDF見開き分割くん｜ブラウザで左右・上下にPDF分割";
const description =
  "見開きPDFをブラウザ内で左右または上下に分割する無料Webアプリ。PDFはサーバーに送信されず、分割位置と出力順を指定できます。";
const siteUrl = "https://pdfsplit.shotaste.com";
const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/"
  },
  keywords: [
    "PDF分割",
    "見開きPDF",
    "PDF左右分割",
    "PDF上下分割",
    "ブラウザ PDF ツール",
    "PDF見開き分割くん"
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "PDF見開き分割くん",
    type: "website",
    locale: "ja_JP",
    images: [
      {
        url: "/social-card.png",
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
    images: ["/social-card.png"],
    site: "@shotaste",
    creator: "@shotaste"
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
      <body>
        {googleAnalyticsId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}');
              `}
            </Script>
          </>
        ) : null}
        {children}
      </body>
    </html>
  );
}
