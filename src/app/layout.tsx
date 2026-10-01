import type { Metadata } from "next";
import { Orbitron, Exo_2, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const displayFont = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const bodyFont = Exo_2({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const technicalFont = IBM_Plex_Mono({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SALVAGE / wallet recovery layer",
  description: "Find the assets your wallet forgot.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${technicalFont.variable}`}>{children}</body>
    </html>
  );
}
