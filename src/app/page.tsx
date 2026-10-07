import Link from "next/link";
import { ProofStack } from "@/components/proof-stack";
import { DrawCheck } from "@/components/draw-check";
import { howItWorks } from "@/lib/data";

export default function HomePage() {
  return (
    <main className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker-bar" aria-hidden="true" />
          <h1 className="display hero-title">
            Your wallet
            <br />
            has leftovers.
          </h1>
          <p className="hero-support">
            Scan your wallet, see what can be counted, and get your authoritative CULLER allocation.
          </p>
          <div className="hero-actions">
            <Link href="/scan" className="primary-button">
              Scan my wallet
            </Link>
            <a href="#how-it-works" className="ghost-button">
              How it works
            </a>
          </div>
          <div className="hero-notice">
            <span>!</span> No seed phrases, no custody. Public wallet data only.
          </div>
        </div>

        <div className="hero-object">
          <ProofStack />
        </div>
      </section>

      <div className="trust-strip" aria-hidden="true">
        <span>No seed phrases</span>
        <span>No custody</span>
        <span>Public wallet data only</span>
        <span>Allocations are recorded</span>
      </div>

      <section className="how-it-works" id="how-it-works">
        <div className="section-intro">
          <h2>A clear path from wallet scan to allocation.</h2>
        </div>
        <div className="how-grid">
          {howItWorks.map((item, index) => (
            <article key={item.step} className="how-card">
              <span className="how-step">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="proof-teaser">
        <div className="proof-teaser-copy">
          <h2>Your allocation is recorded, not guessed.</h2>
          <p>Verified wallet activity is used to calculate an allocation against the active epoch and record it for your history.</p>
          <Link href="/rewards" className="text-link">
            View reward rules
          </Link>
        </div>
        <div className="verify-checklist">
          <div className="verify-row">
            <DrawCheck show size={14} />
            Public wallet data is read from the configured network
          </div>
          <div className="verify-row">
            <DrawCheck show size={14} />
            The Solana wallet remains the primary identity
          </div>
          <div className="verify-row">
            <DrawCheck show size={14} />
            The allocation is recorded in the reward ledger
          </div>
        </div>
      </section>

      <section className="closing-cta">
        <h2>See what your wallet qualifies for.</h2>
        <Link href="/scan" className="primary-button primary-button-lg">
          Scan my wallet
        </Link>
      </section>
    </main>
  );
}
