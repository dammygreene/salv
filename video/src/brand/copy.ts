/**
 * CULLER Brand Film — every word on screen.
 *
 * Headline + supporting copy are the brand's own, taken verbatim from
 * src/app/page.tsx and the live site (culler.vercel.app):
 *   hero:        "Your wallet\nhas leftovers."
 *   support:     "Scan your wallet, see what can be counted, and get your
 *                 authoritative CULLER allocation."
 *   howItWorks:  Scan / Sort / Verify
 * Technical micro-copy mirrors real product strings from src/lib/types.ts,
 * src/lib/data.ts and src/lib/cull/registry.ts — nothing here is invented
 * capability. Where a claim could overstate the product, the copy states the
 * real limit (read-only scan, review before signing, recorded allocation).
 */

export const COPY = {
  /* ── Scene 1 ─────────────────────────────────────────── */
  hookLine1: 'YOUR WALLET',
  hookLine2: 'HAS LEFTOVERS.',
  hookMicro: 'A CULLER FILM',
  hookOverlookedLabel: 'UNSEEN · 214 DAYS',

  /* ── Scene 2 ─────────────────────────────────────────── */
  fieldLabels: ['WALLET INVENTORY', 'ASSET DISCOVERY', 'ACCOUNT DATA'] as const,
  findLine1: 'FIND THE THINGS',
  findLine2: 'YOU FORGOT.',

  /* ── Scene 3 ─────────────────────────────────────────── */
  orderLine1: 'ONE INVENTORY.',
  orderLine2: 'A CLEARER VIEW.',
  sourceSolana: 'SOLANA',
  sourceRobinhood: 'ROBINHOOD CHAIN',
  /** Truthful scope of what each scan actually reads (scanner code). */
  sourceSolanaDetail: 'TOKEN ACCOUNTS · SPL · NFT',
  sourceRobinhoodDetail: 'NATIVE · ERC-20 · 721 · 1155',
  attentionLabel: 'NEEDS ATTENTION',
  /** Count of items shown in the film's inventory, and the two real chains. */
  orderFooter: '10 ITEMS · SOLANA + ROBINHOOD CHAIN',
  orderFooterShort: '10 ITEMS · 2 CHAINS',
  scanMicro: 'READ-ONLY SCAN',

  /* ── Scene 4 ─────────────────────────────────────────── */
  reasonLine1: 'EVERY ITEM',
  reasonLine2: 'GETS A REASON.',
  panelTitle: 'WALLET INVENTORY',
  panelMeta: 'CLASSIFIED · 4 ITEMS',
  /** The four real AssetStatus values (src/lib/types.ts). */
  statuses: ['CULLABLE', 'WATCH', 'REVIEW', 'KEEP'] as const,
  /** Real reason strings in the product's voice; no invented numbers. */
  rows: [
    {
      name: 'Empty token account',
      meta: '4kQf…9vXa',
      status: 'CULLABLE' as const,
      reason: 'EMPTY_TOKEN_ACCOUNT — ZERO BALANCE, RENT RECOVERABLE',
    },
    {
      name: 'Unknown mint, no market',
      meta: '7mTr…2bLp',
      status: 'WATCH' as const,
      reason: 'FUNGIBLE_NO_MARKET — NO PRICE SOURCE FOUND, NOT TREATED AS ZERO',
    },
    {
      name: 'Compressed NFT, unverified',
      meta: 'cNFT · 8Hd2…Qw41',
      status: 'REVIEW' as const,
      reason: 'NFT_REVIEW — COLLECTION UNVERIFIED, MARKET DATA PARTIAL',
    },
    {
      name: 'Active position',
      meta: '3xVa…7Jc9',
      status: 'KEEP' as const,
      reason: 'FUNGIBLE_VALUABLE — LIQUID MARKET, ROUTE AVAILABLE',
    },
  ],

  /* ── Scene 5 ─────────────────────────────────────────── */
  steps: [
    {index: '01', word: 'CULL', micro: 'SELECT THE LEFTOVERS'},
    {index: '02', word: 'VERIFY', micro: 'REVIEW BEFORE SIGNING'},
    {index: '03', word: 'REWARD', micro: 'ALLOCATION RECORDED'},
  ] as const,
  cullNote: 'BIN IS A DECISION, NOT AN ACTION',
  verifyNote: 'SIGNATURE CHECKED AGAINST THE ON-CHAIN RECORD',
  rewardNote: 'EPOCH ALLOCATION WRITTEN TO THE REWARD LEDGER',
  processLine1: 'A CLEAR PROCESS.',
  processLine2: 'REASONS YOU CAN SEE.',

  /* ── Scene 6 ─────────────────────────────────────────── */
  revealLine1: 'YOUR WALLET.',
  revealLine2: 'WITH THE LEFTOVERS FOUND.',

  /* ── Scene 7 ─────────────────────────────────────────── */
  finalTag: 'YOUR WALLET HAS LEFTOVERS.',
  /** Live demo domain today; swap for the production domain at ship time. */
  finalUrl: 'culler.vercel.app',
  finalMicro: 'PUBLIC WALLET DATA ONLY · NO SEED PHRASES · NO CUSTODY',
} as const;
