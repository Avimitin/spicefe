import jsQR from '../vendor/jsqr/jsQR.js';
import {
  decodeSharedProfile,
  ProfileShareError,
} from './profile-share.js';
import { cleanHost } from './profile-store.js';

export const QR_SCAN_FRAME_INTERVAL_MS = 200;
export const QR_SCAN_MAX_FRAME_EDGE = 480;

export class QrScanError extends Error {
  constructor(message, code = 'qr-scan') {
    super(message);
    this.name = 'QrScanError';
    this.code = code;
  }
}

/**
 * Extracts the shared-profile payload from a decoded QR string. Accepts a
 * full spicefe restore URL, a bare `spicefe-profile` query value, or a bare
 * Base64URL payload. Returns the decoded portable profile, or null when the
 * text is not a spicefe share code.
 */
export function parseScannedProfile(text, options = {}) {
  const value = String(text ?? '').trim();
  if (!value) {
    return null;
  }

  const decode = options.decodeSharedProfile ?? decodeSharedProfile;

  let encoded = null;
  if (/^https?:\/\//i.test(value)) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new QrScanError('The scanned link is not a valid spicefe share code', 'invalid');
    }
    encoded = url.searchParams.get('spicefe-profile');
  } else if (value.includes('=')) {
    try {
      encoded = new URLSearchParams(value).get('spicefe-profile');
    } catch {
      encoded = null;
    }
  } else if (/^[A-Za-z0-9_-]+$/.test(value)) {
    // A bare Base64URL payload; anything else is not a share code.
    encoded = value;
  }

  if (!encoded) {
    return null;
  }

  try {
    return decode(encoded);
  } catch (error) {
    if (error instanceof ProfileShareError) {
      throw new QrScanError(error.message, error.code);
    }
    throw new QrScanError('The scanned code is not a valid spicefe share code', 'invalid');
  }
}

/**
 * Maps a decoded shared profile onto the complete server-setup draft. Every
 * portable field the QR code carries is imported — address, password, name,
 * icon, connection style, and stream settings — so a scan replicates the
 * shared server without any further configuration.
 */
export function profileFromScan(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new QrScanError('The scanned code is not a valid spicefe share code', 'invalid');
  }
  let host;
  try {
    host = cleanHost(profile.host);
  } catch (error) {
    throw new QrScanError(error instanceof Error ? error.message : 'Invalid server address', 'host');
  }
  if (!host) {
    throw new QrScanError('The scanned profile has no server address', 'host');
  }
  const port = Number(profile.apiPort);
  if (!Number.isInteger(port) || port < 1 || port > 65533) {
    throw new QrScanError('The scanned profile has an invalid API port', 'port');
  }

  const style = profile.keypadEnabled === true
    ? 'keypad'
    : profile.tickerEnabled === true ? 'ticker' : 'video';

  return {
    host,
    apiPort: port,
    password: typeof profile.password === 'string' ? profile.password : '',
    name: typeof profile.name === 'string' ? profile.name : '',
    iconId: typeof profile.iconId === 'string' ? profile.iconId : '',
    style,
    format: typeof profile.format === 'string' ? profile.format : 'auto',
    screen: typeof profile.screen === 'string' ? profile.screen : '',
    fps: Number(profile.fps),
    quality: Number(profile.quality),
  };
}

/**
 * Decodes one video frame with the vendored jsQR module. The frame is
 * downsampled to a bounded edge length before decoding so phones stay
 * responsive while scanning. Returns the decoded text or null.
 */
export function decodeQrFrame(source, options = {}) {
  const decodeImage = options.decodeImage ?? jsQR;
  const maxEdge = options.maxEdge ?? QR_SCAN_MAX_FRAME_EDGE;
  if (!source || typeof source !== 'object') {
    return null;
  }

  const width = Number(source.videoWidth ?? source.width ?? source.naturalWidth ?? 0);
  const height = Number(source.videoHeight ?? source.height ?? source.naturalHeight ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return null;
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const createCanvas = options.createCanvas
    ?? (() => document.createElement('canvas'));
  const canvas = createCanvas();
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.drawImage(source, 0, 0, targetWidth, targetHeight);
  let imageData;
  try {
    imageData = context.getImageData(0, 0, targetWidth, targetHeight);
  } catch {
    return null;
  }

  const result = decodeImage(imageData.data, targetWidth, targetHeight, {
    inversionAttempts: 'attemptBoth',
  });
  return result ? result.data : null;
}

/**
 * Camera scanning session. Opens the environment-facing camera, draws frames
 * to a preview element, and polls for QR codes until one decodes or stop() is
 * called. All timers and streams are released on stop().
 */
export class QrCameraScanner {
  constructor(options = {}) {
    this.video = options.video ?? null;
    this.decodeFrame = options.decodeFrame ?? decodeQrFrame;
    this.intervalMs = options.intervalMs ?? QR_SCAN_FRAME_INTERVAL_MS;
    this.setTimer = options.setTimer ?? globalThis.setTimeout?.bind(globalThis) ?? setTimeout;
    this.clearTimer = options.clearTimer ?? globalThis.clearTimeout?.bind(globalThis) ?? clearTimeout;
    this.getUserMedia = options.getUserMedia
      ?? ((constraints) => navigator.mediaDevices.getUserMedia(constraints));
    this.ondecoded = options.ondecoded ?? (() => {});
    this.onerror = options.onerror ?? (() => {});
    this.stream = null;
    this.timer = null;
    this.running = false;
    this.stopped = false;
  }

  static get supported() {
    return typeof navigator !== 'undefined'
      && navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function';
  }

  async start() {
    if (this.running || this.stopped) {
      return;
    }
    this.running = true;
    try {
      this.stream = await this.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (error) {
      this.running = false;
      this.onerror(new QrScanError(
        error?.name === 'NotAllowedError'
          ? 'Camera access was denied'
          : error?.name === 'NotFoundError'
            ? 'No camera is available on this device'
            : 'The camera could not be started',
        error?.name === 'NotAllowedError' ? 'denied' : 'camera',
      ));
      return;
    }

    if (this.stopped) {
      this.release();
      return;
    }

    const { video } = this;
    if (video) {
      video.srcObject = this.stream;
      video.autoplay = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        // Autoplay can reject before metadata arrives; the stream keeps
        // decoding once the element becomes ready.
      }
    }
    this.schedule();
  }

  schedule() {
    if (!this.running) {
      return;
    }
    this.timer = this.setTimer(() => this.scan(), this.intervalMs);
  }

  scan() {
    if (!this.running) {
      return;
    }
    const { video } = this;
    if (video && video.readyState >= 2) {
      const text = this.decodeFrame(video);
      if (text) {
        this.ondecoded(text);
        return;
      }
    }
    this.schedule();
  }

  stop() {
    this.stopped = true;
    this.running = false;
    if (this.timer) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    this.release();
  }

  release() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }
}
