import Link from "next/link";
import { CullerMark } from "./culler-mark";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <span className="site-footer-brand-mark">
          <CullerMark size={24} />
          CULLER
        </span>
        <p>Find the assets your wallet forgot, recover what still matters, and get rewarded for cleaning up.</p>
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
      </nav>

      <p className="site-footer-note">
        No seed phrases. No custody. Your wallet signs every action. Demo environment, no live signer attached.
      </p>
    </footer>
  );
}
