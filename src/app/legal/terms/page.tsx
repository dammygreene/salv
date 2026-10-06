import { PageHeader } from "@/components/page-header";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <PageHeader title="Terms." support="The short version. The product talks straight; the terms should too." />
      <div className="legal-body">
        <section>
          <h3>No custody, no guarantees</h3>
          <p>
            CULLER never takes custody of assets. You approve every transaction with your own wallet. Recovered value belongs
            to you; reward tokens are tracked separately.
          </p>
        </section>
        <section>
          <h3>$CULLER is not an investment promise</h3>
          <p>
            $CULLER rewards verified Proof of Cull activity from a finite community pool. Nothing here implies guaranteed
            appreciation, a price floor, or investment returns.
          </p>
        </section>
        <section>
          <h3>Destructive actions are irreversible</h3>
          <p>Closing an account or burning a token cannot be undone. Review every transaction summary before confirming.</p>
        </section>
        <section>
          <h3>This build</h3>
          <p>This is a demo environment for evaluation purposes. No live signer or mainnet transaction is attached yet.</p>
        </section>
      </div>
    </main>
  );
}
