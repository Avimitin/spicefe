import { H264PlayerError } from './h264-player.js';
import { targetAddressSpaceForUrl } from './endpoints.js';

function mediaSourceAvailable() {
  return typeof globalThis.MediaSource !== 'undefined'
    || typeof globalThis.ManagedMediaSource !== 'undefined'
    || typeof globalThis.WebKitMediaSource !== 'undefined';
}

export class MseH264Player {
  static get supported() {
    return typeof globalThis.JMuxer === 'function'
      && mediaSourceAvailable()
      && typeof globalThis.AbortController !== 'undefined'
      && typeof globalThis.fetch !== 'undefined';
  }

  constructor(video, options = {}) {
    this.video = video;
    this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    this.JMuxerImpl = options.JMuxerImpl || globalThis.JMuxer;
    this.controller = null;
    this.muxer = null;
    this.frameCallback = null;
    this.eventFrameHandler = null;
    this.decodedFrames = 0;
    this.lastMetricAt = 0;
    this.lastMetricFrames = 0;
    this.fps = 0;

    this.onresponse = () => {};
    this.onframe = () => {};
    this.onerror = () => {};
  }

  async start(url, fps = 30) {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;

    try {
      await this.createMuxer(controller, fps);
      if (this.controller !== controller) {
        return;
      }

      this.watchFrames(controller);
      const play = this.video.play();
      play?.catch?.(() => {});

      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
        referrerPolicy: 'no-referrer',
        targetAddressSpace: targetAddressSpaceForUrl(url),
      });
      if (this.controller !== controller) {
        return;
      }
      if (!response.ok) {
        throw new H264PlayerError(`Video server returned HTTP ${response.status}`, {
          status: response.status,
          code: 'http',
        });
      }
      if (!response.body) {
        throw new H264PlayerError('The browser did not expose the video response body', {
          code: 'stream',
        });
      }

      this.onresponse(response);
      const reader = response.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (this.controller !== controller) {
          return;
        }
        if (done) {
          throw new H264PlayerError('The video stream ended', { code: 'ended' });
        }
        this.muxer.feed({ video: value });
      }
    } catch (error) {
      if (this.controller === controller && error?.name !== 'AbortError') {
        this.fail(error instanceof H264PlayerError
          ? error
          : new H264PlayerError(error?.message || 'Could not open the H.264 stream', {
            cause: error,
            code: 'transport',
          }));
      }
    }
  }

  createMuxer(controller, fps) {
    return new Promise((resolve, reject) => {
      let settled = false;
      controller.signal.addEventListener('abort', () => {
        if (!settled) {
          settled = true;
          const error = new Error('H.264 playback was stopped');
          error.name = 'AbortError';
          reject(error);
        }
      }, { once: true });
      const rejectOnce = (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        } else if (this.controller === controller) {
          this.fail(error);
        }
      };

      try {
        this.muxer = new this.JMuxerImpl({
          node: this.video,
          mode: 'video',
          live: true,
          fps: Math.max(1, Number(fps) || 30),
          flushingTime: 0,
          maxDelay: 100,
          clearBuffer: true,
          debug: false,
          onReady: () => {
            if (!settled && this.controller === controller) {
              settled = true;
              resolve();
            }
          },
          onError: (detail) => rejectOnce(new H264PlayerError(
            detail?.message || 'The browser media buffer failed',
            { code: 'mse-buffer' },
          )),
          onUnsupportedCodec: (codec) => rejectOnce(new H264PlayerError(
            `This browser cannot play ${codec || 'the H.264 stream'}`,
            { code: 'unsupported-codec' },
          )),
          // jMuxer 2.1.1 does not populate its cleanup index even when
          // clearBuffer is enabled. Supplying the documented callback keeps
          // long-running streams bounded without changing the vendored code.
          onKeyframePosition: (time) => this.muxer?.kfPosition?.push(time),
        });
      } catch (error) {
        rejectOnce(new H264PlayerError(
          error?.message || String(error) || 'Could not create a media source',
          { cause: error, code: 'unsupported-codec' },
        ));
      }
    });
  }

  watchFrames(controller) {
    if (typeof this.video.requestVideoFrameCallback === 'function') {
      const next = (_now, metadata = {}) => {
        if (this.controller !== controller) {
          return;
        }
        this.reportFrame(metadata.presentedFrames);
        this.frameCallback = this.video.requestVideoFrameCallback(next);
      };
      this.frameCallback = this.video.requestVideoFrameCallback(next);
      return;
    }

    this.eventFrameHandler = () => {
      if (this.controller === controller && this.video.readyState >= 2) {
        this.reportFrame();
      }
    };
    this.video.addEventListener('loadeddata', this.eventFrameHandler);
    this.video.addEventListener('timeupdate', this.eventFrameHandler);
  }

  reportFrame(presentedFrames) {
    const quality = this.video.getVideoPlaybackQuality?.();
    const frameCount = Number(presentedFrames || quality?.totalVideoFrames || 0);
    this.decodedFrames = frameCount > 0 ? frameCount : this.decodedFrames + 1;

    const now = performance.now();
    if (this.lastMetricAt === 0) {
      this.lastMetricAt = now;
      this.lastMetricFrames = this.decodedFrames;
    } else if (now - this.lastMetricAt >= 500) {
      this.fps = (this.decodedFrames - this.lastMetricFrames) * 1000
        / (now - this.lastMetricAt);
      this.lastMetricAt = now;
      this.lastMetricFrames = this.decodedFrames;
    }

    this.onframe({
      width: this.video.videoWidth,
      height: this.video.videoHeight,
      fps: this.fps,
      decodedFrames: this.decodedFrames,
      droppedFrames: Number(quality?.droppedVideoFrames || 0),
    });
  }

  stop() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    if (this.frameCallback !== null && this.video.cancelVideoFrameCallback) {
      this.video.cancelVideoFrameCallback(this.frameCallback);
    }
    this.frameCallback = null;
    if (this.eventFrameHandler) {
      this.video.removeEventListener('loadeddata', this.eventFrameHandler);
      this.video.removeEventListener('timeupdate', this.eventFrameHandler);
      this.eventFrameHandler = null;
    }
    if (this.muxer) {
      try {
        this.muxer.destroy();
      } catch {
        // MediaSource may already be closed after an error.
      }
      this.muxer = null;
    }
    this.video.pause?.();
    this.video.removeAttribute?.('src');
    this.video.querySelectorAll?.('source').forEach((source) => source.remove());
    this.video.load?.();
    this.decodedFrames = 0;
    this.lastMetricAt = 0;
    this.lastMetricFrames = 0;
    this.fps = 0;
  }

  fail(error) {
    const wasRunning = this.controller !== null;
    this.stop();
    if (wasRunning) {
      this.onerror(error);
    }
  }
}
