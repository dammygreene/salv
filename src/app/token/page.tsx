import { CullerMintDisplay } from "@/components/culler-mint-display";
import { PageHeader } from "@/components/page-header";

export default function TokenPage() {
  return (
    <main className="token-page">
      <PageHeader
        title="One screen. No microsite."
        support="CULLER is the reward token for verified cleanup activity. The model stays simple on purpose."
      />

      <div className="token-supply">
        <div className="token-supply-total">
          <span>Total supply</span>
          <strong>1,000,000,000</strong>
          <small>$CULLER, Solana</small>
        </div>
        <div className="token-supply-bar" role="img" aria-label="30 percent community cull rewards, 70 percent market allocation">
          <span className="token-supply-fill-rewards" style={{ width: "30%" }} />
          <span className="token-supply-fill-market" style={{ width: "70%" }} />
        </div>
        <div className="token-supply-legend">
          <div>
            <i className="legend-dot legend-rewards" /> Cull rewards <strong>30%</strong>
          </div>
          <div>
            <i className="legend-dot legend-market" /> Market <strong>70%</strong>
          </div>
        </div>
      </div>

      <div className="token-grid">
        <article className="token-panel">
          <h3>No hidden allocations</h3>
          <p>No investor round. No strategic bucket. No separate marketing or ecosystem allocation. What you see is the whole supply.</p>
        </article>
        <article className="token-panel">
          <h3>Reward mechanism</h3>
          <p>
            <code>Valid cull → cull score → $CULLER</code>
          </p>
          <p>Community rewards are a finite pool released over fixed epochs. Each epoch has a fixed budget split across verified participants.</p>
        </article>
        <article className="token-panel">
          <h3>Public token metadata</h3>
          <p>
            CULLER is deployed and managed outside this app. This page displays
            public token metadata; the app does not custody, mint, distribute,
            or buy back tokens.
          </p>
        </article>
        <article className="token-panel">
          <h3>Recovered value stays yours</h3>
          <p>Recovered SOL or assets belong to you. Reward tokens are tracked and shown separately, recovered and reward are never mixed.</p>
        </article>
      </div>

      <CullerMintDisplay />
    </main>
  );
}
