import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type SiteFrameProps = {
  children: ReactNode;
};

export default function SiteFrame({ children }: SiteFrameProps) {
  return (
    <main id="top" className="app-shell">
      <header className="site-header">
        <Link className="site-brand" href="/" aria-label="PDF見開き分割くん トップ">
          <Image src="/assets/character.svg" alt="" width={54} height={54} aria-hidden="true" />
          <span className="site-brand-text">
            <span className="site-logo">PDF Split</span>
            <span className="site-title">PDF見開き分割くん</span>
          </span>
        </Link>
        <div className="site-header-meta">
          <p className="site-lead">見開きPDFを左右または上下に分割して、2ページずつのPDFに変換できます。</p>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <p className="site-copy">© 2026 PDF見開き分割くん</p>
        <Link className="site-privacy-link-footer" href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
