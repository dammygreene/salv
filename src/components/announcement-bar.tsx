"use client";

import Link from "next/link";
import { useState } from "react";

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="announce-bar">
      <span>
        This is a <strong>demo environment</strong>. No live signer is connected yet.
      </span>
      <Link href="/scan">Try a scan →</Link>
      <button className="announce-close" onClick={() => setDismissed(true)} aria-label="Dismiss announcement">
        ×
      </button>
    </div>
  );
}
