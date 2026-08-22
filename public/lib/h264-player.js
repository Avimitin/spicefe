import { AnnexBParser, codecStringFromSps, joinAnnexB, NAL_TYPE } from './annex-b.js';
import { targetAddressSpaceForUrl } from './endpoints.js';

export class H264PlayerError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'H264PlayerError';
    this.status = options.status;
    this.code = options.code || 'decoder';
  }
}

export class H264Player {
  static QUEUE_LIMIT = 6;

  static get supported() {
    return typeof globalThis.VideoDecoder !== 'undefined'
      && typeof globalThis.EncodedVideoChunk !== 'undefined'
      && typeof globalThis.AbortController !== 'undefined'
      && typeof globalThis.fetch !== 'undefined';
  }

  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
    this.VideoDecoderImpl = options.VideoDecoderImpl || globalThis.VideoDecoder;
    this.EncodedVideoChunkImpl = options.EncodedVideoChunkImpl || globalThis.EncodedVideoChunk;

    this.controller = null;
    this.decoder = null;
    this.parser = new AnnexBParser((nal) => this.pushNal(nal));
    this.accessUnit = [];
    this.frameDuration = 1_000_000 / 30;
    this.decodeIndex = 0;
    this.decodedFrames = 0;
    this.droppedFrames = 0;
    this.resyncing = false;
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
    this.frameDuration = 1_000_000 / Math.max(1, fps);

    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
        referrerPolicy: 'no-referrer',
        // Chromium uses this hint when a name is not visibly private before DNS resolution.
        // Other browsers ignore unknown RequestInit members.
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
        this.parser.push(value);
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

  stop() {
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    if (this.decoder) {
      try {
        this.decoder.close();
      } catch {
        // A decoder error may already have closed it.
      }
      this.decoder = null;
    }

    this.parser.reset();
    this.accessUnit = [];
    this.decodeIndex = 0;
    this.decodedFrames = 0;
    this.droppedFrames = 0;
    this.resyncing = false;
    this.fps = 0;
    this.lastMetricAt = 0;
    this.lastMetricFrames = 0;
  }

  fail(error) {
    const wasRunning = this.controller !== null;
    this.stop();
    if (wasRunning) {
      this.onerror(error);
    }
  }

  pushNal(nal) {
    const type = nal[0] & 0x1f;
    if (type === NAL_TYPE.SPS && !this.decoder) {
      this.configure(nal);
    }
    if (!this.decoder) {
      return;
    }

    this.accessUnit.push(nal);
    // spice2x's zerolatency x264 configuration emits one VCL NAL for each picture.
    if (type === NAL_TYPE.SLICE || type === NAL_TYPE.IDR) {
      this.emit(type === NAL_TYPE.IDR);
    }
  }

  configure(sps) {
    const codec = codecStringFromSps(sps);
    try {
      this.decoder = new this.VideoDecoderImpl({
        output: (frame) => this.draw(frame),
        error: (error) => {
          if (this.controller) {
            this.fail(new H264PlayerError(error?.message || 'H.264 decoder failed', {
              cause: error,
              code: 'decoder',
            }));
          }
        },
      });
      // Omitting description explicitly selects Annex-B for AVC in WebCodecs.
      this.decoder.configure({ codec, optimizeForLatency: true });
    } catch (error) {
      this.decoder = null;
      throw new H264PlayerError(`This browser cannot decode ${codec}`, {
        cause: error,
        code: 'unsupported-codec',
      });
    }
  }

  emit(key) {
    const queued = Number(this.decoder.decodeQueueSize || 0);
    if (queued > H264Player.QUEUE_LIMIT && !this.resyncing) {
      try {
        this.decoder.reset();
      } catch {
        // Dropping until IDR still bounds latency if reset is unavailable.
      }
      this.resyncing = true;
      this.droppedFrames += queued;
    }

    if (this.resyncing && !key) {
      this.accessUnit = [];
      this.droppedFrames += 1;
      return;
    }
    this.resyncing = false;

    const data = joinAnnexB(this.accessUnit);
    this.accessUnit = [];
    const timestamp = Math.round(this.decodeIndex * this.frameDuration);
    this.decodeIndex += 1;

    try {
      this.decoder.decode(new this.EncodedVideoChunkImpl({
        type: key ? 'key' : 'delta',
        timestamp,
        duration: Math.round(this.frameDuration),
        data,
      }));
    } catch (error) {
      this.fail(new H264PlayerError(error?.message || 'H.264 chunk was rejected', {
        cause: error,
        code: 'decoder',
      }));
    }
  }

  draw(frame) {
    const width = frame.displayWidth || frame.codedWidth;
    const height = frame.displayHeight || frame.codedHeight;
    try {
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.context.drawImage(frame, 0, 0, width, height);
    } finally {
      frame.close();
    }

    this.decodedFrames += 1;
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
      width,
      height,
      fps: this.fps,
      decodedFrames: this.decodedFrames,
      droppedFrames: this.droppedFrames,
    });
  }
}
