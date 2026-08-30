import { streamUrl } from './endpoints.js';
import { H264Player } from './h264-player.js';
import { BLANK_IIDX_TICKER } from './iidx-ticker.js';
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
  static MEMORY_POLL_MS = 10000;
  static TICKER_POLL_MS = 100;
  static TICKER_RETRY_MS = 1000;

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
    this.videoResponded = false;
    this.videoError = null;
    this.apiError = null;
    this.gameInfo = null;
    this.touchCanvas = null;
    this.streamRetryDelay = 1000;
    this.apiRetryDelay = 1000;
    this.streamRetryTimer = null;
    this.apiRetryTimer = null;
    this.stallTimer = null;
    this.stallDeadline = 0;
    this.memoryTimer = null;
    this.tickerTimer = null;
    this.tickerText = BLANK_IIDX_TICKER;
    this.mjpegActive = false;
    this.fellBackToMjpeg = false;
    this.failedH264Backends = new Set();

    this.onstate = () => {};
    this.onnotice = () => {};
    this.onframe = () => {};
    this.onapi = () => {};
    this.onmemory = () => {};
    this.onticker = () => {};

    this.webCodecsPlayer.onresponse = () => this.videoResponse('webcodecs');
    this.webCodecsPlayer.onframe = (metric) => this.videoFrame(metric, 'webcodecs');
    this.webCodecsPlayer.onerror = (error) => this.videoFailedFor(error, 'webcodecs');
    this.msePlayer.onresponse = () => this.videoResponse('mse');
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
      videoResponded: this.videoResponded,
      videoError: this.videoError,
      apiError: this.apiError,
      gameInfo: this.gameInfo,
      touchCanvas: this.touchCanvas ? { ...this.touchCanvas } : null,
      displayMode: this.profile?.tickerEnabled ? 'ticker' : 'video',
      tickerText: this.tickerText,
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
    this.videoResponded = false;
    this.videoError = null;
    this.apiError = null;
    this.streamRetryDelay = 1000;
    this.apiRetryDelay = 1000;
    this.fellBackToMjpeg = false;
    this.failedH264Backends.clear();
    if (this.profile.tickerEnabled) {
      this.videoFormat = 'ticker';
    }
    this.emitState();
    if (!this.profile.tickerEnabled) {
      this.startVideo();
    }
    this.startApi();
  }

  disconnect() {
    this.wanted = false;
    clearTimeout(this.streamRetryTimer);
    clearTimeout(this.apiRetryTimer);
    clearTimeout(this.tickerTimer);
    this.stopStallWatchdog();
    clearInterval(this.memoryTimer);
    this.streamRetryTimer = null;
    this.apiRetryTimer = null;
    this.memoryTimer = null;
    this.tickerTimer = null;

    this.stopH264();
    this.stopMjpeg();
    this.api?.close();
    this.api = null;
    this.onapi(null);
    this.onmemory(null);
    this.clearStreamViews();

    this.videoState = 'idle';
    this.apiState = 'idle';
    this.videoFormat = null;
    this.videoBackend = null;
    this.videoResponded = false;
    this.videoError = null;
    this.apiError = null;
    this.gameInfo = null;
    this.touchCanvas = null;
    this.tickerText = BLANK_IIDX_TICKER;
    this.onticker(this.tickerText);
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
    if (!this.wanted || this.profile?.tickerEnabled) {
      return;
    }
    clearTimeout(this.streamRetryTimer);
    this.stopStallWatchdog();
    this.streamRetryTimer = null;
    this.videoState = 'connecting';
    this.videoResponded = false;
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
    this.stallDeadline = Date.now() + SpiceSession.STREAM_STALL_MS;
    if (this.stallTimer === null) {
      this.stallTimer = setTimeout(
        () => this.checkStall(),
        SpiceSession.STREAM_STALL_MS,
      );
    }
  }

  checkStall() {
    this.stallTimer = null;
    if (!this.wanted || this.stallDeadline === 0) {
      return;
    }
    const remaining = this.stallDeadline - Date.now();
    if (remaining > 0) {
      this.stallTimer = setTimeout(() => this.checkStall(), remaining);
      return;
    }
    this.stallDeadline = 0;
    this.videoFailed(new Error('No video frames arrived from that screen'));
  }

  stopStallWatchdog() {
    clearTimeout(this.stallTimer);
    this.stallTimer = null;
    this.stallDeadline = 0;
  }

  armStallFor(backend) {
    if (this.videoBackend === backend) {
      this.armStall();
    }
  }

  videoResponse(backend) {
    if (!this.wanted || this.videoBackend !== backend) {
      return;
    }
    this.videoResponded = true;
    this.armStallFor(backend);
    this.emitState();
  }

  videoFrame(metric, backend) {
    if (!this.wanted || this.videoFormat !== 'h264' || this.videoBackend !== backend) {
      return;
    }
    this.armStall();
    this.videoResponded = true;
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
    this.stopStallWatchdog();
    this.videoResponded = true;
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
    this.stopStallWatchdog();
    this.videoResponded ||= Number.isFinite(error?.status);

    if (this.videoFormat === 'h264'
      && this.profile.format === 'auto'
      && error?.status === 404) {
      this.fellBackToMjpeg = true;
      this.onnotice('notice.h264MissingMjpeg');
      this.stopH264();
      this.startVideo();
      return;
    }

    if (this.videoFormat === 'h264'
      && ['unsupported-codec', 'decoder', 'mse-buffer'].includes(error?.code)) {
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
    if (this.profile?.tickerEnabled) {
      if (this.api?.connected && this.tickerTimer === null) {
        this.tickerTimer = setTimeout(
          () => this.pollTicker(this.api),
          0,
        );
      } else if (!this.api?.connected && !this.apiRetryTimer) {
        this.startApi();
      }
      return;
    }
    this.stopH264();
    this.stopMjpeg();
    this.stopStallWatchdog();
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
    clearTimeout(this.tickerTimer);
    clearInterval(this.memoryTimer);
    this.apiRetryTimer = null;
    this.memoryTimer = null;
    this.tickerTimer = null;
    this.onmemory(null);
    this.api?.close();

    if (this.profile?.tickerEnabled) {
      this.videoState = 'connecting';
      this.videoResponded = false;
      this.videoError = null;
    }

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
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
      this.onmemory(null);
      this.apiState = 'error';
      this.failTickerWithApi();
      this.emitState();
      return;
    }

    if (state === 'closed') {
      clearInterval(this.memoryTimer);
      this.memoryTimer = null;
      this.onmemory(null);
      this.apiState = 'error';
      this.failTickerWithApi();
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
      if (this.profile.tickerEnabled) {
        this.startTicker(api);
      } else {
        this.startMemoryPolling(api);
      }
      this.emitState();
    } catch (error) {
      if (this.api !== api || !this.wanted) {
        return;
      }
      this.apiError = error;
      this.apiState = 'error';
      this.failTickerWithApi(error);
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
    clearInterval(this.memoryTimer);
    clearTimeout(this.tickerTimer);
    this.memoryTimer = null;
    this.tickerTimer = null;
    this.onmemory(null);
    this.apiRetryTimer = setTimeout(() => this.startApi(), this.apiRetryDelay);
    this.apiRetryDelay = Math.min(this.apiRetryDelay * 2, SpiceSession.API_RETRY_MAX_MS);
  }

  startMemoryPolling(api) {
    clearInterval(this.memoryTimer);
    const updateMemory = async () => {
      if (this.api !== api || !api.connected || this.profile?.tickerEnabled) {
        return;
      }
      try {
        const memory = await api.getMemoryInfo();
        if (this.api === api && api.connected && !this.profile?.tickerEnabled) {
          this.onmemory(memory);
        }
      } catch {
        // Memory telemetry is optional and must not interrupt video or touch.
      }
    };
    void updateMemory();
    this.memoryTimer = setInterval(
      () => void updateMemory(),
      SpiceSession.MEMORY_POLL_MS,
    );
  }

  failTickerWithApi(error = this.apiError) {
    if (!this.profile?.tickerEnabled) {
      return;
    }
    clearTimeout(this.tickerTimer);
    this.tickerTimer = null;
    this.videoState = 'error';
    this.videoError = error || new Error('The control API disconnected from the 16-segment display');
  }

  startTicker(api) {
    clearTimeout(this.tickerTimer);
    this.tickerTimer = null;
    this.videoState = 'connecting';
    this.videoResponded = false;
    this.videoError = null;
    void this.pollTicker(api);
  }

  async pollTicker(api) {
    this.tickerTimer = null;
    if (!this.wanted || !this.profile?.tickerEnabled || this.api !== api || !api.connected) {
      return;
    }

    try {
      const text = await api.tickerGet();
      if (!this.wanted || this.api !== api || !this.profile?.tickerEnabled) {
        return;
      }
      const becameLive = this.videoState !== 'live';
      const changed = text !== this.tickerText;
      this.tickerText = text;
      this.videoState = 'live';
      this.videoResponded = true;
      this.videoError = null;
      if (changed || becameLive) {
        this.onticker(text);
      }
      if (becameLive) {
        this.emitState();
      }
      this.tickerTimer = setTimeout(
        () => this.pollTicker(api),
        SpiceSession.TICKER_POLL_MS,
      );
    } catch (error) {
      if (!this.wanted || this.api !== api || !this.profile?.tickerEnabled) {
        return;
      }
      this.videoState = 'error';
      this.videoError = error;
      this.emitState();
      if (api.connected) {
        this.tickerTimer = setTimeout(
          () => this.pollTicker(api),
          SpiceSession.TICKER_RETRY_MS,
        );
      }
    }
  }
}
