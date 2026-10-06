import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <h1 className="display">Signal lost.</h1>
      <p>This compartment doesn&apos;t exist. The machine couldn&apos;t find what you&apos;re looking for.</p>
      <Link href="/" className="primary-button">
        Return home
      </Link>
    </main>
  );
}
