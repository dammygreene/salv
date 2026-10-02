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
            Find the accounts you forgot. Close the ones worth closing. Get rewarded for the cleanup, with every
            step verified onchain.
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
            <span>!</span> No seed phrases, no custody. Your wallet signs every action.
          </div>
        </div>

        <div className="hero-object">
          <ProofStack />
        </div>
      </section>

      <div className="trust-strip" aria-hidden="true">
        <span>No seed phrases</span>
        <span>No custody</span>
        <span>Your wallet signs everything</span>
        <span>Rewards need proof</span>
      </div>

      <section className="how-it-works" id="how-it-works">
        <div className="section-intro">
          <h2>A machine that explains every decision it makes.</h2>
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
          <h2>Every verified action becomes a receipt.</h2>
          <p>The reward pool is finite. The rules stay visible. Nothing is credited without independent verification.</p>
          <Link href="/rewards" className="text-link">
            View reward rules
          </Link>
        </div>
        <div className="verify-checklist">
          <div className="verify-row">
            <DrawCheck show size={14} />
            Onchain state is re-read after the action completes
          </div>
          <div className="verify-row">
            <DrawCheck show size={14} />
            An independent verifier has to agree with the result
          </div>
          <div className="verify-row">
            <DrawCheck show size={14} />
            The epoch still has reward budget remaining
          </div>
        </div>
      </section>

      <section className="closing-cta">
        <h2>Your wallet is holding dead weight.</h2>
        <Link href="/scan" className="primary-button primary-button-lg">
          Scan my wallet
        </Link>
      </section>
    </main>
  );
}
