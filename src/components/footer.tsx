import Link from "next/link";
import { CullerLogo } from "./culler-logo";
import { OfficialXLink } from "./official-x-link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <span className="site-footer-brand-mark">
          <CullerLogo />
        </span>
        <p>Scan public wallet data, see your verified CULLER allocation, and share the result.</p>
      </div>

      <nav className="site-footer-col" aria-label="Product">
        <span className="site-footer-col-title">Product</span>
        <Link href="/scan">Scan</Link>
        <Link href="/watch">Watch</Link>
        <Link href="/rewards">Rewards</Link>
        <Link href="/token">$CULLER</Link>
      </nav>

      <nav className="site-footer-col" aria-label="Legal">
        <span className="site-footer-col-title">Legal</span>
        <Link href="/legal/privacy">Privacy</Link>
        <Link href="/legal/terms">Terms</Link>
        <OfficialXLink className="site-footer-x" />
      </nav>

      <p className="site-footer-note">
        No seed phrases. No custody. Public wallet data only.
      </p>
    </footer>
  );
}
