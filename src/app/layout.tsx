import type { Metadata } from "next";
import { AppStateProvider } from "@/lib/app-state";
import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { AmbientBackground } from "@/components/ambient-background";
import { AnnouncementBar } from "@/components/announcement-bar";
import { NavCapsule } from "@/components/nav-capsule";
import { SiteFooter } from "@/components/footer";

import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://cullerlabs.xyz"),
  title: "CULLER: wallet recovery layer",
  description: "Find the assets your wallet forgot. Recover what still matters. Get rewarded for cleaning up.",
  openGraph: {
    title: "CULLER: your wallet has leftovers.",
    description: "Find the assets you forgot. Recover what still matters. Get rewarded for cleaning up.",
    type: "website",
  },
};

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
            <AnnouncementBar />
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
