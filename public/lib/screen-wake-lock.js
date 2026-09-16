// Keep canvas, MJPEG, and API-only displays awake as well as native video.
export class ScreenWakeLock {
  constructor(options = {}) {
    this.document = options.document || globalThis.document;
    this.window = options.window || globalThis.window;
    this.wakeLock = (options.navigator || globalThis.navigator)?.wakeLock;
    this.active = false;
    this.suspended = false;
    this.sentinel = null;
    this.pending = null;
    this.video = null;

    this.refresh = () => {
      if (this.shouldHold()) {
        void this.acquire();
      } else {
        this.release();
      }
    };
    this.onPageHide = () => {
      this.suspended = true;
      this.release();
    };
    this.onPageShow = () => {
      this.suspended = false;
      this.refresh();
    };
    // Interactions also retry playback if the browser initially denied autoplay.
    this.events = ['visibilitychange', 'fullscreenchange', 'click', 'pointerup', 'keydown'];
    for (const event of this.events) {
      this.document.addEventListener(event, this.refresh);
    }
    this.window.addEventListener('pagehide', this.onPageHide);
    this.window.addEventListener('pageshow', this.onPageShow);
  }

  update({ wanted, videoState }) {
    // Connecting is included so the HTTP fallback starts in the Connect gesture.
    const active = wanted && ['connecting', 'live'].includes(videoState);
    if (this.active === active) {
      return;
    }
    this.active = active;
    this.refresh();
  }

  shouldHold() {
    return this.active && !this.suspended && this.document.visibilityState === 'visible';
  }

  async acquire() {
    if (!this.shouldHold() || this.pending || this.sentinel || (this.video && !this.video.paused)) {
      return;
    }
    const pending = {};
    this.pending = pending;
    try {
      if (typeof this.wakeLock?.request === 'function') {
        const sentinel = await this.wakeLock.request('screen');
        // Requests can finish after disconnect, backgrounding, or a new session.
        if (this.pending !== pending || !this.shouldHold()) {
          await this.releaseSentinel(sentinel);
          return;
        }
        this.sentinel = sentinel;
        sentinel.addEventListener('release', () => {
          if (this.sentinel === sentinel) {
            this.sentinel = null;
          }
          // Do not spin on an OS-initiated release (for example, low battery).
          // Visibility changes or a later interaction can retry the request.
        }, { once: true });
      } else {
        // Plain HTTP pages cannot use the native API. NoSleep's small, silent
        // video clips provide a local fallback without changing the LAN setup.
        this.video ||= this.createVideo();
        await this.video.play();
        if (!this.shouldHold()) {
          this.video.pause();
        }
      }
    } catch {
      // Power-saving policies, permissions, and autoplay restrictions must not
      // interrupt the stream. Retry on visibility changes or user interaction.
    } finally {
      if (this.pending === pending) {
        this.pending = null;
      }
    }
  }

  createVideo() {
    const video = this.document.createElement('video');
    video.setAttribute('playsinline', '');
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.loop = true;
    for (const format of ['webm', 'mp4']) {
      const source = this.document.createElement('source');
      source.src = `./vendor/nosleep/wake-lock.${format}`;
      source.type = `video/${format}`;
      video.appendChild(source);
    }
    // NoSleep's MP4 needs a seek before its end to keep iOS playback awake.
    video.addEventListener('timeupdate', () => {
      if (video.duration > 1 && video.currentTime > 0.5) {
        video.currentTime = Math.random() * 0.5;
      }
    });
    return video;
  }

  async releaseSentinel(sentinel) {
    try {
      await sentinel.release();
    } catch {
      // The browser may have already revoked this lock during navigation.
    }
  }

  release() {
    this.pending = null;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel) {
      void this.releaseSentinel(sentinel);
    }
    this.video?.pause();
  }

  destroy() {
    this.active = false;
    this.release();
    for (const event of this.events) {
      this.document.removeEventListener(event, this.refresh);
    }
    this.window.removeEventListener('pagehide', this.onPageHide);
    this.window.removeEventListener('pageshow', this.onPageShow);
  }
}
