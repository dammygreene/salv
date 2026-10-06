import { getPublicCullerConfig } from "./public-config";

export const CULLER_SITE_URL = getPublicCullerConfig().siteUrl;
export const CULLER_SITE_LABEL = "cullerlabs.xyz";

export type CullerShareData = {
  allocation: string;
  walletAddress?: string;
  epochId?: number | null;
  verified: boolean;
  xHandle?: string;
  siteUrl?: string;
};

export type CullerShareFonts = {
  jakarta500: string;
  jakarta700: string;
  jakarta800: string;
  mono400: string;
};

export function formatCullerAllocation(value: string): string {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return "0";
  const [whole, fraction = ""] = value.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  const sign = whole.startsWith("-") ? "-" : "";
  const unsignedWhole = sign ? whole.slice(1) : whole;
  const formattedWhole = unsignedWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${formattedWhole}${trimmedFraction ? `.${trimmedFraction}` : ""}`;
}

export function shortenCullerWallet(address: string): string {
  if (address.length <= 11) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function hasCullerAllocation(value: string): boolean {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return false;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) > 0n || /[1-9]/.test(fraction);
}

export function buildCullerPostText(data: CullerShareData): string {
  const handle = data.xHandle ? ` @${data.xHandle.replace(/^@/, "")}` : "";
  return [
    `Just checked my wallet with CULLER${handle}.`,
    "",
    `Found an allocation of +${formatCullerAllocation(data.allocation)} $CULLER.`,
    "",
    "CULL what you don't need.",
    data.siteUrl ?? CULLER_SITE_URL,
  ].join("\n");
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return entities[character];
  });
}

export function buildCullerShareCardSvg(data: CullerShareData, logoHref?: string, fonts?: CullerShareFonts): string {
  const allocation = escapeXml(formatCullerAllocation(data.allocation));
  const siteUrl = escapeXml((data.siteUrl ?? CULLER_SITE_URL).replace(/^https?:\/\//, "").replace(/\/$/, ""));
  const wallet = data.walletAddress ? escapeXml(shortenCullerWallet(data.walletAddress)) : "";
  const status = data.verified ? "ALLOCATION VERIFIED" : "ALLOCATION RECORDED";
  const fontFaces = fonts
    ? `<style>
      @font-face{font-family:'Plus Jakarta Sans';font-weight:500;src:url(${fonts.jakarta500}) format('woff2')}
      @font-face{font-family:'Plus Jakarta Sans';font-weight:700;src:url(${fonts.jakarta700}) format('woff2')}
      @font-face{font-family:'Plus Jakarta Sans';font-weight:800;src:url(${fonts.jakarta800}) format('woff2')}
      @font-face{font-family:'JetBrains Mono';font-weight:400;src:url(${fonts.mono400}) format('woff2')}
    </style>`
    : "";
  const allocationFontSize = allocation.length > 14 ? 64 : allocation.length > 10 ? 78 : 92;
  const logoUrl =
    logoHref ??
    (typeof window === "undefined"
      ? `${CULLER_SITE_URL}/brand/culler-logo-on-dark.svg`
      : new URL("/brand/culler-logo-on-dark.svg", window.location.origin).href);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>${fontFaces}
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#080D1C"/><stop offset="1" stop-color="#101B38"/></linearGradient>
    <radialGradient id="glow" cx="82%" cy="8%" r="70%"><stop stop-color="#3159E8" stop-opacity=".28"/><stop offset="1" stop-color="#3159E8" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#91A9FF" stroke-opacity=".07"/></pattern>
  </defs>
  <rect width="1200" height="675" rx="28" fill="url(#bg)"/>
  <rect width="1200" height="675" rx="28" fill="url(#glow)"/>
  <rect width="1200" height="675" rx="28" fill="url(#grid)"/>
  <rect x="52" y="52" width="1096" height="571" rx="20" fill="none" stroke="#7794FF" stroke-opacity=".22"/>
  <image href="${logoUrl}" x="88" y="78" width="220" height="86" preserveAspectRatio="xMidYMid meet"/>
  <text x="1112" y="116" text-anchor="end" fill="#A8C0FF" font-family="'Plus Jakarta Sans',sans-serif" font-size="18" font-weight="700" letter-spacing="3">${status}</text>
  <text x="88" y="260" fill="#A8B6D8" font-family="'Plus Jakarta Sans',sans-serif" font-size="22" font-weight="700" letter-spacing="5">YOUR WALLET HAD</text>
  <text x="88" y="305" fill="#F4F7FF" font-family="'Plus Jakarta Sans',sans-serif" font-size="42" font-weight="800" letter-spacing="2">DEAD WEIGHT.</text>
  <text x="88" y="440" fill="#FF7A1A" font-family="'Plus Jakarta Sans',sans-serif" font-size="${allocationFontSize}" font-weight="800" letter-spacing="-2">+${allocation}</text>
  <text x="92" y="482" fill="#FF9142" font-family="'Plus Jakarta Sans',sans-serif" font-size="27" font-weight="700" letter-spacing="4">$CULLER</text>
  ${wallet ? `<text x="1112" y="482" text-anchor="end" fill="#8B9BBC" font-family="'JetBrains Mono',monospace" font-size="20">${wallet}</text>` : ""}
  <path d="M88 548H1112" stroke="#7794FF" stroke-opacity=".22"/>
  <text x="88" y="585" fill="#A8B6D8" font-family="'Plus Jakarta Sans',sans-serif" font-size="21">CULL what you don't need.</text>
  <text x="1112" y="585" text-anchor="end" fill="#F4F7FF" font-family="'Plus Jakarta Sans',sans-serif" font-size="21" font-weight="700">${siteUrl}</text>
</svg>`;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function getCullerLogoDataUrl(): Promise<string> {
  const response = await fetch("/brand/culler-logo-on-dark.svg");
  if (!response.ok) throw new Error("Could not load the CULLER logo for the share card.");
  const svg = await response.text();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function getFontDataUrl(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load card font: ${path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:font/woff2;base64,${btoa(binary)}`;
}

export async function getCullerShareFonts(): Promise<CullerShareFonts> {
  const [jakarta500, jakarta700, jakarta800, mono400] = await Promise.all([
    getFontDataUrl("/fonts/plus-jakarta-sans-500.woff2"),
    getFontDataUrl("/fonts/plus-jakarta-sans-700.woff2"),
    getFontDataUrl("/fonts/plus-jakarta-sans-800.woff2"),
    getFontDataUrl("/fonts/jetbrains-mono-400.woff2"),
  ]);
  return { jakarta500, jakarta700, jakarta800, mono400 };
}

export async function generateCullerShareCard(data: CullerShareData): Promise<Blob> {
  const logoDataUrl = await getCullerLogoDataUrl();
  const fonts = await getCullerShareFonts();
  const jakarta500 = new FontFace("Plus Jakarta Sans", `url(${fonts.jakarta500})`, { weight: "500" });
  const jakarta700 = new FontFace("Plus Jakarta Sans", `url(${fonts.jakarta700})`, { weight: "700" });
  const jakarta800 = new FontFace("Plus Jakarta Sans", `url(${fonts.jakarta800})`, { weight: "800" });
  const mono400 = new FontFace("JetBrains Mono", `url(${fonts.mono400})`, { weight: "400" });
  await Promise.all([jakarta500.load(), jakarta700.load(), jakarta800.load(), mono400.load()]);
  document.fonts.add(jakarta500);
  document.fonts.add(jakarta700);
  document.fonts.add(jakarta800);
  document.fonts.add(mono400);

  const logo = new Image();
  logo.src = logoDataUrl;
  await logo.decode();

  const allocation = formatCullerAllocation(data.allocation);
  const siteUrl = (data.siteUrl ?? CULLER_SITE_URL).replace(/^https?:\/\//, "").replace(/\/$/, "");
  const wallet = data.walletAddress ? shortenCullerWallet(data.walletAddress) : "";
  const status = data.verified ? "ALLOCATION VERIFIED" : "ALLOCATION RECORDED";
  const allocationFontSize = allocation.length > 14 ? 64 : allocation.length > 10 ? 78 : 92;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 675;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the share card canvas.");

  const background = context.createLinearGradient(0, 0, 1200, 675);
  background.addColorStop(0, "#080D1C");
  background.addColorStop(1, "#101B38");
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 675);
  const glow = context.createRadialGradient(984, 54, 0, 984, 54, 840);
  glow.addColorStop(0, "rgba(49, 89, 232, 0.28)");
  glow.addColorStop(1, "rgba(49, 89, 232, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1200, 675);
  context.strokeStyle = "rgba(145, 169, 255, 0.07)";
  context.lineWidth = 1;
  for (let x = 48; x < 1200; x += 48) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 675);
    context.stroke();
  }
  for (let y = 48; y < 675; y += 48) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1200, y);
    context.stroke();
  }
  context.strokeStyle = "rgba(119, 148, 255, 0.22)";
  context.lineWidth = 1;
  context.roundRect(52, 52, 1096, 571, 20);
  context.stroke();
  context.drawImage(logo, 88, 78, 220, 86);

  context.textAlign = "right";
  context.fillStyle = "#A8C0FF";
  context.font = "700 18px 'Plus Jakarta Sans'";
  context.fillText(status, 1112, 116);
  context.textAlign = "left";
  context.fillStyle = "#A8B6D8";
  context.font = "700 22px 'Plus Jakarta Sans'";
  context.fillText("YOUR WALLET HAD", 88, 260);
  context.fillStyle = "#F4F7FF";
  context.font = "800 42px 'Plus Jakarta Sans'";
  context.fillText("DEAD WEIGHT.", 88, 305);
  context.fillStyle = "#FF7A1A";
  context.font = `800 ${allocationFontSize}px 'Plus Jakarta Sans'`;
  context.fillText(`+${allocation}`, 88, 440);
  context.fillStyle = "#FF9142";
  context.font = "700 27px 'Plus Jakarta Sans'";
  context.fillText("$CULLER", 92, 482);
  if (wallet) {
    context.textAlign = "right";
    context.fillStyle = "#8B9BBC";
    context.font = "400 20px 'JetBrains Mono'";
    context.fillText(wallet, 1112, 482);
  }
  context.textAlign = "left";
  context.strokeStyle = "rgba(119, 148, 255, 0.22)";
  context.beginPath();
  context.moveTo(88, 548);
  context.lineTo(1112, 548);
  context.stroke();
  context.fillStyle = "#A8B6D8";
  context.font = "500 21px 'Plus Jakarta Sans'";
  context.fillText("CULL what you don't need.", 88, 585);
  context.textAlign = "right";
  context.fillStyle = "#F4F7FF";
  context.font = "700 21px 'Plus Jakarta Sans'";
  context.fillText(siteUrl, 1112, 585);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export the share card."))), "image/png");
  });
}
