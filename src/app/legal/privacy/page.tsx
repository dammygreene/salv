import { PageHeader } from "@/components/page-header";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <PageHeader title="Privacy." support="What CULLER reads, what it never asks for, and what it stores." />
      <div className="legal-body">
        <section>
          <h3>What we read</h3>
          <p>
            A scan reads public network data for the Solana wallet address you provide: token accounts, balances, NFT metadata,
            and supported wallet activity. This is the same data anyone can see on a block explorer. You may optionally provide
            a Robinhood wallet address for the same combined scan.
          </p>
        </section>
        <section>
          <h3>What we never ask for</h3>
          <p>CULLER never asks for a seed phrase, private key, wallet connection, or custody of your funds. Scanning and allocation review are read-only.</p>
        </section>
        <section>
          <h3>What we store</h3>
          <p>
            Scan results, allocation and epoch information, and the Solana wallet address used for leaderboard identity are
            stored in the application ledger. An optional Robinhood address may be stored as metadata on that same submission.
            Allocation data can be exported by the team as CSV. We do not sell wallet data to third parties.
          </p>
        </section>
      </div>
    </main>
  );
}
