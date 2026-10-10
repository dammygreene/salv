/**
 * CULLER Brand Film — master timeline.
 *
 * 35s @ 30fps = 1050 frames. Seven scenes. Every cue in the film (motion,
 * type, audio) is keyed off these frame constants so the whole piece stays
 * deterministic and re-timable from one place.
 */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const V_WIDTH = 1080;
export const V_HEIGHT = 1920;
export const DURATION_SECONDS = 35;
export const TOTAL_FRAMES = FPS * DURATION_SECONDS; // 1050

export const S = (seconds: number): number => seconds * FPS;

export type SceneKey = 'hook' | 'inventory' | 'order' | 'reason' | 'process' | 'reveal' | 'final';

export interface SceneSpec {
  key: SceneKey;
  /** First frame of the scene, inclusive. */
  from: number;
  /** Frame count. */
  duration: number;
  title: string;
}

export const SCENES: Record<SceneKey, SceneSpec> = {
  hook: {key: 'hook', from: S(0), duration: S(4), title: 'The hook'},
  inventory: {key: 'inventory', from: S(4), duration: S(5), title: 'The forgotten inventory'},
  order: {key: 'order', from: S(9), duration: S(6), title: 'From scattered to organized'},
  reason: {key: 'reason', from: S(15), duration: S(7), title: 'Every item gets a reason'},
  process: {key: 'process', from: S(22), duration: S(6), title: 'Cull. Verify. Reward.'},
  reveal: {key: 'reveal', from: S(28), duration: S(4), title: 'Brand reveal'},
  final: {key: 'final', from: S(32), duration: S(3), title: 'Final card'},
};

export const SCENE_ORDER: SceneKey[] = ['hook', 'inventory', 'order', 'reason', 'process', 'reveal', 'final'];

/** Scene-local frame for a global frame. */
export const localFrame = (globalFrame: number, key: SceneKey): number => globalFrame - SCENES[key].from;

/**
 * Beat map used by both the film and the audio mix (tools/make-audio.mjs
 * reads these to place cues at exact sample positions).
 */
export const CUES = {
  /** Tiny overlooked item nudges into view. */
  firstNudge: 24,
  /** "YOUR WALLET" word slides in. */
  headlineWord1: 36,
  /** "HAS LEFTOVERS." mask reveal. */
  headlineWord2: 54,
  /** Orange full stop lands. */
  headlinePunch: 96,
  /** Headline settles into its editorial position. */
  headlineSettle: 120,
  /** Asset field begins unfolding. */
  fieldOpen: 132,
  /** Blue connective paths draw. */
  fieldPaths: 168,
  /** Orange flags the overlooked pair. */
  fieldFlag: 186,
  /** FIND THE THINGS / YOU FORGOT. */
  findThings: 216,
  /** Reflow into the ordered inventory begins. */
  reflowStart: 276,
  /** Source chips (Solana / Robinhood Chain) converge. */
  sourcesIn: 300,
  /** Rows lock. */
  reflowLock: 372,
  /** ONE INVENTORY. / A CLEARER VIEW. */
  oneInventory: 396,
  /** Product panel wipes in. */
  panelIn: 456,
  /** Row states set, one at a time. */
  rowState: [486, 510, 534, 558] as const,
  /** Row expands with its reason. */
  rowExpand: 582,
  /** EVERY ITEM / GETS A REASON. — lands with the first set states so the
   *  left column never sits empty while the interface works. */
  everyItem: 506,
  /** Process beats. */
  cullBeat: 666,
  verifyBeat: 726,
  rewardBeat: 786,
  /** A CLEAR PROCESS. / REASONS YOU CAN SEE. */
  clearProcess: 806,
  /** Collapse toward the alignment point. */
  collapse: 846,
  /** Mark tiles assemble. */
  markAssemble: 872,
  /** Wordmark clip reveal + orange line. */
  wordmarkIn: 900,
  /** Closing copy. */
  revealCopy: 924,
  /** Final card set. */
  finalCard: 966,
  /** Frame from which the last frame must hold still (promo frame). */
  finalHold: 1002,
} as const;
