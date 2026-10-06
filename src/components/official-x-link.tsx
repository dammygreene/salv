"use client";

import { XLogo } from "@phosphor-icons/react";

export const OFFICIAL_X_URL = "https://x.com/cullerlabs";

export function OfficialXLink({ className = "" }: { className?: string }) {
  return (
    <a
      className={className}
      href={OFFICIAL_X_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="CULLER official X account"
    >
      <XLogo size={18} weight="bold" aria-hidden="true" />
      <span>@cullerlabs</span>
    </a>
  );
}
