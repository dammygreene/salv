import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppStateProvider } from "@/lib/app-state";
import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { AmbientBackground } from "@/components/ambient-background";
import { NavCapsule } from "@/components/nav-capsule";
import { SiteFooter } from "@/components/footer";

import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

const baseMetadata: Metadata = {
  title: "CULLER: wallet allocation platform",
  description: "Scan your Solana wallet, calculate your verified CULLER allocation, and share the result.",
  openGraph: {
    title: "CULLER: your wallet has leftovers.",
    description: "Scan your wallet, calculate your CULLER allocation, and share the result.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CULLER: your wallet has leftovers.",
    description: "Scan your wallet, calculate your CULLER allocation, and share the result.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "https";
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    "https://cullerlabs.xyz";

  return {
    ...baseMetadata,
    metadataBase: new URL(host ? `${protocol}://${host}` : configuredUrl),
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SolanaWalletProvider>
          <AppStateProvider>
            <AmbientBackground />
            <NavCapsule />
            <div id="main-content" className="page-shell">
              {children}
            </div>
            <SiteFooter />
          </AppStateProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
