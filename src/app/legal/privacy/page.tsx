import { PageHeader } from "@/components/page-header";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <PageHeader title="Privacy." support="What SALVAGE reads, what it never asks for, and what it stores." />
      <div className="legal-body">
        <section>
          <h3>What we read</h3>
          <p>
            A scan reads public onchain data for the wallet address you provide: token accounts, balances, NFT metadata, and
            known protocol positions. This is the same data anyone can see on a block explorer.
          </p>
        </section>
        <section>
          <h3>What we never ask for</h3>
          <p>SALVAGE never asks for a seed phrase, private key, or custody of your funds. Every action is signed by your own wallet.</p>
        </section>
        <section>
          <h3>What we store</h3>
          <p>
            Scan results, salvage events, and Proof of Salvage receipts are stored against your wallet address so your history and
            rewards persist across sessions. We do not sell wallet data to third parties.
          </p>
        </section>
        <section>
          <h3>This build</h3>
          <p>This is a demo environment. No live indexer or signer is connected yet, so nothing here reflects real wallet data.</p>
        </section>
      </div>
    </main>
  );
}
