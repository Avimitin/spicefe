import { streamUrl } from './endpoints.js';
import { H264Player } from './h264-player.js';
import { MseH264Player } from './mse-h264-player.js';
import { SpiceApi } from './spice-api.js';

const BLANK_IMAGE = 'data:image/gif;base64,'
  + 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const MODEL_CANVAS = Object.freeze({
  LDJ: { width: 1280, height: 720 },
  KFC: { width: 1920, height: 1080 },
  M39: { width: 1280, height: 800 },
});

function touchCanvasForGame(info) {
  if (info?.model === 'M32' && (info.spec === 'C' || info.spec === 'D')) {
    return { width: 800, height: 1280 };
  }
  return MODEL_CANVAS[info?.model] || null;
}

export class SpiceSession {
  static STREAM_STALL_MS = 8000;
  static STREAM_RETRY_MAX_MS = 15000;
  static API_RETRY_MAX_MS = 15000;
  static PING_MS = 10000;

  constructor(canvas, video, image) {
    this.canvas = canvas;
    this.video = video;
    this.image = image;
    this.webCodecsPlayer = new H264Player(canvas);
    this.msePlayer = new MseH264Player(video);
    this.api = null;
    this.profile = null;
    this.wanted = false;
    this.videoState = 'idle';
    this.apiState = 'idle';
    this.videoFormat = null;
    this.videoBackend = null;
    this.videoError = null;
    this.apiError = null;
    this.gameInfo = null;
    this.touchCanvas = null;
    this.streamRetryDelay = 1000;
    this.apiRetryDelay = 1000;
    this.streamRetryTimer = null;
    this.apiRetryTimer = null;
    this.stallTimer = null;
    this.pingTimer = null;
    this.mjpegActive = false;
    this.fellBackToMjpeg = false;
    this.failedH264Backends = new Set();

    this.onstate = () => {};
    this.onnotice = () => {};
    this.onframe = () => {};
    this.onapi = () => {};

    this.webCodecsPlayer.onresponse = () => this.armStallFor('webcodecs');
    this.webCodecsPlayer.onframe = (metric) => this.videoFrame(metric, 'webcodecs');
    this.webCodecsPlayer.onerror = (error) => this.videoFailedFor(error, 'webcodecs');
    this.msePlayer.onresponse = () => this.armStallFor('mse');
    this.msePlayer.onframe = (metric) => this.videoFrame(metric, 'mse');
    this.msePlayer.onerror = (error) => this.videoFailedFor(error, 'mse');
    this.image.addEventListener('load', () => this.mjpegLoaded());
    this.image.addEventListener('error', () => this.mjpegFailed());
  }

  get snapshot() {
    return {
      wanted: this.wanted,
      profile: this.profile ? { ...this.profile } : null,
      videoState: this.videoState,
      apiState: this.apiState,
      videoFormat: this.videoFormat,
      videoBackend: this.videoBackend,
      videoError: this.videoError,
      apiError: this.apiError,
      gameInfo: this.gameInfo,
      touchCanvas: this.touchCanvas ? { ...this.touchCanvas } : null,
      connected: this.videoState === 'live' && this.apiState === 'live',
    };
  }

  emitState() {
    this.onstate(this.snapshot);
  }

  connect(profile) {
    this.disconnect();
    this.profile = { ...profile };
    this.wanted = true;
    this.videoState = 'connecting';
    this.apiState = 'connecting';
    this.videoError = null;
    this.apiError = null;
    this.streamRetryDelay = 1000;
    this.apiRetryDelay = 1000;
    this.fellBackToMjpeg = false;
    this.failedH264Backends.clear();
    this.emitState();
    this.startVideo();
    this.startApi();
  }

  disconnect() {
    this.wanted = false;
    clearTimeout(this.streamRetryTimer);
    clearTimeout(this.apiRetryTimer);
    clearTimeout(this.stallTimer);
    clearInterval(this.pingTimer);
    this.streamRetryTimer = null;
    this.apiRetryTimer = null;
    this.stallTimer = null;
    this.pingTimer = null;

    this.stopH264();
    this.stopMjpeg();
    this.api?.close();
    this.api = null;
    this.onapi(null);
    this.clearStreamViews();

    this.videoState = 'idle';
    this.apiState = 'idle';
    this.videoFormat = null;
    this.videoBackend = null;
    this.videoError = null;
    this.apiError = null;
    this.gameInfo = null;
    this.touchCanvas = null;
    this.emitState();
  }

  clearStreamViews() {
    this.canvas.hidden = true;
    this.video.hidden = true;
    this.image.hidden = true;
    // Resizing a canvas clears its backing buffer, including the final decoded frame.
    this.canvas.width = 0;
    this.canvas.height = 0;
  }

  startVideo() {
    if (!this.wanted) {
      return;
    }
    clearTimeout(this.streamRetryTimer);
    clearTimeout(this.stallTimer);
    this.streamRetryTimer = null;
    this.videoState = 'connecting';
    this.videoError = null;

    const wantsH264 = this.profile.format !== 'mjpg' && !this.fellBackToMjpeg;
    const backend = wantsH264 ? this.nextH264Backend() : null;
    if (backend) {
      this.videoFormat = 'h264';
      this.videoBackend = backend;
      this.mjpegActive = false;
      this.stopMjpeg();
      this.image.hidden = true;
      this.canvas.hidden = backend !== 'webcodecs';
      this.video.hidden = backend !== 'mse';
      this.currentH264Player().start(streamUrl(this.profile, 'h264'), this.profile.fps);
      this.armStall();
    } else if (wantsH264 && this.profile.format === 'h264') {
      this.videoFormat = 'h264';
      this.videoBackend = null;
      this.videoState = 'error';
      this.videoError = 'H.264 decoding is unavailable in this browser context';
      this.emitState();
      return;
    } else {
      if (wantsH264) {
        this.onnotice('notice.h264UnavailableMjpeg');
      }
      this.videoFormat = 'mjpg';
      this.videoBackend = null;
      this.stopH264();
      this.canvas.hidden = true;
      this.video.hidden = true;
      this.image.hidden = false;
      this.mjpegActive = true;
      this.image.src = streamUrl(this.profile, 'mjpg');
      this.armStall();
    }
    this.emitState();
  }

  nextH264Backend() {
    if (H264Player.supported && !this.failedH264Backends.has('webcodecs')) {
      return 'webcodecs';
    }
    if (MseH264Player.supported && !this.failedH264Backends.has('mse')) {
      return 'mse';
    }
    return null;
  }

  currentH264Player() {
    return this.videoBackend === 'mse' ? this.msePlayer : this.webCodecsPlayer;
  }

  stopH264() {
    this.webCodecsPlayer.stop();
    this.msePlayer.stop();
  }

  stopMjpeg() {
    if (!this.mjpegActive && this.image.src.startsWith('data:')) {
      return;
    }
    this.mjpegActive = false;
    this.image.src = BLANK_IMAGE;
  }

  armStall() {
    clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(() => {
      this.videoFailed(new Error('No video frames arrived from that screen'));
    }, SpiceSession.STREAM_STALL_MS);
  }

  armStallFor(backend) {
    if (this.videoBackend === backend) {
      this.armStall();
    }
  }

  videoFrame(metric, backend) {
    if (!this.wanted || this.videoFormat !== 'h264' || this.videoBackend !== backend) {
      return;
    }
    this.armStall();
    const becameLive = this.videoState !== 'live';
    this.videoState = 'live';
    this.videoError = null;
    this.streamRetryDelay = 1000;
    this.onframe(metric);
    if (becameLive) {
      this.emitState();
    }
  }

  videoFailedFor(error, backend) {
    if (this.videoBackend === backend) {
      this.videoFailed(error);
    }
  }

  mjpegLoaded() {
    if (!this.wanted || !this.mjpegActive || this.image.src.startsWith('data:')) {
      return;
    }
    clearTimeout(this.stallTimer);
    this.stallTimer = null;
    this.videoState = 'live';
    this.videoError = null;
    this.streamRetryDelay = 1000;
    this.onframe({
      width: this.image.naturalWidth,
      height: this.image.naturalHeight,
      fps: 0,
      decodedFrames: 0,
      droppedFrames: 0,
    });
    this.emitState();
  }

  mjpegFailed() {
    if (this.wanted && this.mjpegActive && !this.image.src.startsWith('data:')) {
      this.videoFailed(new Error('Could not open the MJPEG stream'));
    }
  }

  videoFailed(error) {
    if (!this.wanted) {
      return;
    }
    clearTimeout(this.stallTimer);
    this.stallTimer = null;

    if (this.videoFormat === 'h264'
      && this.profile.format === 'auto'
      && error?.status === 404) {
      this.fellBackToMjpeg = true;
      this.onnotice('notice.h264MissingMjpeg');
      this.stopH264();
      this.startVideo();
      return;
    }

    if (this.videoFormat === 'h264' && error?.code === 'unsupported-codec') {
      if (this.videoBackend) {
        this.failedH264Backends.add(this.videoBackend);
      }
      this.stopH264();
      const fallbackBackend = this.nextH264Backend();
      if (fallbackBackend) {
        this.onnotice('notice.h264Alternate');
        this.startVideo();
        return;
      }
      if (this.profile.format === 'auto') {
        this.fellBackToMjpeg = true;
        this.onnotice('notice.h264DecodeMjpeg');
        this.startVideo();
        return;
      }
    }

    this.stopH264();
    this.stopMjpeg();
    this.videoState = 'error';
    this.videoError = error?.message || 'Video stream failed';
    this.emitState();

    this.streamRetryTimer = setTimeout(() => this.startVideo(), this.streamRetryDelay);
    this.streamRetryDelay = Math.min(
      this.streamRetryDelay * 2,
      SpiceSession.STREAM_RETRY_MAX_MS,
    );
  }

  restartVideo() {
    if (!this.wanted) {
      return;
    }
    this.stopH264();
    this.stopMjpeg();
    clearTimeout(this.streamRetryTimer);
    this.videoState = 'connecting';
    this.emitState();
    this.streamRetryTimer = setTimeout(() => this.startVideo(), 250);
  }

  startApi() {
    if (!this.wanted) {
      return;
    }
    clearTimeout(this.apiRetryTimer);
    this.apiRetryTimer = null;
    this.api?.close();

    const api = new SpiceApi(this.profile);
    this.api = api;
    this.onapi(api);
    api.onstate = (state) => this.apiChanged(api, state);
    api.onerror = (error) => {
      if (this.api === api) {
        this.apiError = error;
        this.emitState();
      }
    };
    api.connect();
  }

  apiChanged(api, state) {
    if (this.api !== api || !this.wanted) {
      return;
    }
    if (state === 'connecting' || state === 'open') {
      this.apiState = state === 'open' ? 'checking' : 'connecting';
      this.apiError = null;
      this.emitState();
      if (state === 'open') {
        this.verifyApi(api);
      }
      return;
    }

    if (state === 'error') {
      this.apiState = 'error';
      this.emitState();
      return;
    }

    if (state === 'closed') {
      this.apiState = 'error';
      this.emitState();
      if (this.apiError?.code !== 'password') {
        this.scheduleApiRetry();
      }
    }
  }

  async verifyApi(api) {
    try {
      const data = await api.request('info', 'avs');
      if (this.api !== api || !this.wanted) {
        return;
      }
      this.gameInfo = data[0] || {};
      this.touchCanvas = touchCanvasForGame(this.gameInfo);
      this.apiState = 'live';
      this.apiError = null;
      this.apiRetryDelay = 1000;
      this.startPing(api);
      this.emitState();
    } catch (error) {
      if (this.api !== api || !this.wanted) {
        return;
      }
      this.apiError = error;
      this.apiState = 'error';
      this.emitState();
      if (error?.code !== 'password') {
        this.scheduleApiRetry();
      }
    }
  }

  scheduleApiRetry() {
    if (!this.wanted || this.apiRetryTimer) {
      return;
    }
    clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.apiRetryTimer = setTimeout(() => this.startApi(), this.apiRetryDelay);
    this.apiRetryDelay = Math.min(this.apiRetryDelay * 2, SpiceSession.API_RETRY_MAX_MS);
  }

  startPing(api) {
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.api === api && api.connected) {
        api.request('info', 'avs').catch(() => {});
      }
    }, SpiceSession.PING_MS);
  }

  async setResizeScene(scene) {
    if (!this.api?.connected || this.apiState !== 'live') {
      throw new Error('Input API is not connected');
    }
    await this.api.request('resize', 'image_resize_set_scene', [Number(scene)]);
  }
}
