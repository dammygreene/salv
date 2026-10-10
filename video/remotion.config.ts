import {Config} from '@remotion/cli/config';

/**
 * CULLER Brand Film — render configuration.
 *
 * Master spec: 1920×1080, 30fps, 35s (1050 frames), H.264 MP4.
 * Dimensions/duration/fps live on the <Composition> declarations in src/Root.tsx.
 */
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setCodec('h264');
// Renders run inside a sandboxed container; keep concurrency modest and stable.
Config.setConcurrency(2);
