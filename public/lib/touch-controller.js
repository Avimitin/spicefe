const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

export function renderedContentRect(elementRect, sourceSize) {
  if (!elementRect.width || !elementRect.height || !sourceSize.width || !sourceSize.height) {
    return null;
  }

  const scale = Math.min(
    elementRect.width / sourceSize.width,
    elementRect.height / sourceSize.height,
  );
  const width = sourceSize.width * scale;
  const height = sourceSize.height * scale;
  return {
    left: elementRect.left + (elementRect.width - width) / 2,
    top: elementRect.top + (elementRect.height - height) / 2,
    width,
    height,
  };
}

export function mapClientPoint(clientX, clientY, contentRect, canvasSize, requireInside = true) {
  if (!contentRect || !canvasSize.width || !canvasSize.height) {
    return null;
  }
  const u = (clientX - contentRect.left) / contentRect.width;
  const v = (clientY - contentRect.top) / contentRect.height;
  if (requireInside && (u < 0 || u > 1 || v < 0 || v > 1)) {
    return null;
  }
  return {
    x: clamp(Math.round(u * canvasSize.width), 0, canvasSize.width - 1),
    y: clamp(Math.round(v * canvasSize.height), 0, canvasSize.height - 1),
  };
}

export class TouchController {
  static REPEAT_MS = 50;

  constructor(stage, options = {}) {
    this.stage = stage;
    this.activeView = options.activeView;
    this.viewSize = options.viewSize;
    this.onmarker = options.onmarker || (() => {});
    this.requestFrame = options.requestAnimationFrameImpl || globalThis.requestAnimationFrame.bind(globalThis);
    this.cancelFrame = options.cancelAnimationFrameImpl || globalThis.cancelAnimationFrame.bind(globalThis);
    this.api = null;
    this.canvasSize = null;
    this.enabled = false;
    this.pointers = new Map();
    this.resets = [];
    this.nextTouchId = 1;
    this.frameRequest = null;
    this.moveDirty = false;
    this.marker = null;
    this.geometry = null;
    this.repeatTimer = null;

    this.onPointerDown = (event) => this.pointerDown(event);
    this.onPointerMove = (event) => this.pointerMove(event);
    this.onPointerEnd = (event) => this.pointerEnd(event);
    this.onBlur = () => this.releaseAll();
    this.onVisibility = () => {
      if (document.hidden) {
        this.releaseAll();
      }
    };

    stage.addEventListener('pointerdown', this.onPointerDown);
    stage.addEventListener('pointermove', this.onPointerMove);
    stage.addEventListener('pointerup', this.onPointerEnd);
    stage.addEventListener('pointercancel', this.onPointerEnd);
    stage.addEventListener('lostpointercapture', this.onPointerEnd);
    stage.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pagehide', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    const invalidate = () => this.invalidateGeometry();
    window.addEventListener('resize', invalidate);
    window.addEventListener('scroll', invalidate, true);
    document.addEventListener('fullscreenchange', invalidate);
    window.visualViewport?.addEventListener('resize', invalidate);
    window.visualViewport?.addEventListener('scroll', invalidate);
  }

  setApi(api) {
    if (api === this.api) return;
    this.releaseAll();
    clearTimeout(this.repeatTimer);
    this.repeatTimer = null;
    this.resets.length = 0;
    this.api = api;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this.releaseAll();
    }
  }

  setCanvasSize(size) {
    this.canvasSize = size?.width > 0 && size?.height > 0 ? { ...size } : null;
  }

  invalidateGeometry() {
    this.geometry = null;
  }

  contentRect(source = this.viewSize()) {
    const view = this.activeView();
    if (!view) return null;
    if (!this.geometry || this.geometry.view !== view
      || this.geometry.width !== source.width || this.geometry.height !== source.height) {
      this.geometry = {
        view,
        width: source.width,
        height: source.height,
        rect: renderedContentRect(view.getBoundingClientRect(), source),
      };
      this.scheduleFlush();
    }
    return this.geometry.rect;
  }

  pointFromEvent(event, requireInside) {
    const source = this.viewSize();
    const target = this.canvasSize || source;
    return mapClientPoint(
      event.clientX,
      event.clientY,
      this.contentRect(source),
      target,
      requireInside,
    );
  }

  pointerDown(event) {
    if (!this.enabled || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    if (event.target.closest('button, select, input, label')) {
      return;
    }

    this.invalidateGeometry();
    const point = this.pointFromEvent(event, true);
    if (!point) {
      return;
    }
    event.preventDefault();

    if (this.nextTouchId > 0xffff) {
      this.nextTouchId = 1;
    }
    const touch = { id: this.nextTouchId, ...point, clientX: event.clientX, clientY: event.clientY };
    this.nextTouchId += 1;
    this.pointers.set(event.pointerId, touch);
    this.marker = { visible: true, clientX: event.clientX, clientY: event.clientY };

    try {
      this.stage.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an optimization; the contact remains valid without it.
    }
    this.scheduleFlush();
    // Contact transitions must survive even when a complete tap fits between
    // display refreshes, or another finger arrives while the API is busy.
    this.flush(false);
  }

  pointerMove(event) {
    const active = this.pointers.get(event.pointerId);
    if (!active) {
      return;
    }
    const point = this.pointFromEvent(event, false);
    if (!point || (active.x === point.x && active.y === point.y)) {
      return;
    }

    event.preventDefault();
    active.x = point.x;
    active.y = point.y;
    active.clientX = event.clientX;
    active.clientY = event.clientY;
    this.marker = { visible: true, clientX: event.clientX, clientY: event.clientY };
    this.moveDirty = true;
    this.scheduleFlush();
  }

  pointerEnd(event) {
    const active = this.pointers.get(event.pointerId);
    if (!active) {
      return;
    }
    if (this.moveDirty) this.flush();
    this.pointers.delete(event.pointerId);
    this.resets.push(active.id);
    if (this.pointers.size === 0) {
      this.moveDirty = false;
      this.cancelScheduledFrame();
      this.marker = null;
      this.onmarker({ visible: false });
    } else {
      const remaining = this.pointers.values().next().value;
      this.marker = { visible: true, clientX: remaining.clientX, clientY: remaining.clientY };
      this.scheduleFlush();
    }
    this.flush(false);
  }

  scheduleFlush() {
    if (this.frameRequest !== null) {
      return;
    }
    this.frameRequest = this.requestFrame(() => {
      this.frameRequest = null;
      // Cache only within one display frame so arbitrary layout changes cannot
      // leave an ongoing drag mapped against old geometry.
      this.invalidateGeometry();
      if (this.marker) {
        this.onmarker(this.marker);
        this.marker = null;
      }
      if (this.moveDirty) this.flush();
    });
  }

  cancelScheduledFrame() {
    if (this.frameRequest !== null) this.cancelFrame(this.frameRequest);
    this.frameRequest = null;
    this.invalidateGeometry();
  }

  flush(coalesce = true) {
    clearTimeout(this.repeatTimer);
    this.repeatTimer = null;

    if (this.api?.connected) {
      if (this.resets.length > 0) {
        if (this.api.send('touch', 'write_reset', [...this.resets]) !== false) {
          this.resets.length = 0;
        }
      }
      if (this.pointers.size > 0) {
        const params = Array.from(this.pointers.values(), ({ id, x, y }) => [id, x, y]);
        if (this.api.send('touch', 'write', params, coalesce ? 'touch.write' : null) !== false) {
          this.moveDirty = false;
        }
      }
    } else {
      this.resets.length = 0;
    }

    // Refresh a held contact only after a quiet period. A repeat never clears a
    // pending animation callback or sends a second copy of its movement.
    if (this.pointers.size > 0 || this.resets.length > 0) {
      this.repeatTimer = setTimeout(() => this.flush(), TouchController.REPEAT_MS);
    }
  }

  releaseAll() {
    for (const point of this.pointers.values()) {
      this.resets.push(point.id);
    }
    this.pointers.clear();
    this.moveDirty = false;
    this.cancelScheduledFrame();
    this.marker = null;
    this.onmarker({ visible: false });
    this.flush(false);
  }
}
