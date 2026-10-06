export function ProofStack() {
  return (
    <div className="proof-stack" aria-hidden="true">
      <div className="receipt-card receipt-back" />
      <div className="receipt-card receipt-mid" />
      <article className="receipt-card receipt-top">
        <div className="receipt-top-row">
          <span className="code">Event 0003184</span>
          <span className="receipt-stamp">
            <span className="receipt-stamp-ring" />
            <svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
              <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3.5 4" />
              <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M21 33l7 7 15-17" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="receipt-stamp-label">Verified</span>
          </span>
        </div>
        <div className="proof-flow">
          <span>Cull</span>
          <b>→</b>
          <span>Verify</span>
          <b>→</b>
          <span>Reward</span>
        </div>
        <div className="proof-confirm">
          <strong>Valid cull event</strong>
          <b>+960 $CULLER</b>
        </div>
      </article>
    </div>
  );
}
