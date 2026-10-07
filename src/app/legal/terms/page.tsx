import { PageHeader } from "@/components/page-header";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <PageHeader title="Terms." support="The short version. The product talks straight; the terms should too." />
      <div className="legal-body">
        <section>
          <h3>No custody, no guarantees</h3>
          <p>
            CULLER never takes custody of assets and does not execute wallet transactions. The app reads public wallet data,
            calculates allocations, and records results. The token itself is deployed and managed separately from this app.
          </p>
        </section>
        <section>
          <h3>$CULLER is not an investment promise</h3>
          <p>
            $CULLER allocations are based on the configured eligibility and epoch rules. Nothing here implies guaranteed
            appreciation, a price floor, token distribution timing, or investment returns.
          </p>
        </section>
        <section>
          <h3>Public data and availability</h3>
          <p>You are responsible for the wallet addresses you submit. Results depend on available network data, configured snapshots, and service availability.</p>
        </section>
      </div>
    </main>
  );
}
