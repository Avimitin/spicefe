const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);

export function renderedContentRect(elementRect, sourceSize, viewMode = 'contain') {
  if (!elementRect.width || !elementRect.height || !sourceSize.width || !sourceSize.height) {
    return null;
  }

  if (viewMode === 'fill') {
    return { ...elementRect };
  }

  const scale = viewMode === 'cover'
    ? Math.max(elementRect.width / sourceSize.width, elementRect.height / sourceSize.height)
    : Math.min(elementRect.width / sourceSize.width, elementRect.height / sourceSize.height);
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
    this.api = null;
    this.canvasSize = null;
    this.viewMode = 'contain';
    this.enabled = false;
    this.pointers = new Map();
    this.resets = [];
    this.nextTouchId = 1;
    this.flushQueued = false;
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
  }

  setApi(api) {
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

  setViewMode(mode) {
    this.viewMode = mode;
  }

  contentRect() {
    const view = this.activeView();
    const source = this.viewSize();
    return view ? renderedContentRect(view.getBoundingClientRect(), source, this.viewMode) : null;
  }

  pointFromEvent(event, requireInside) {
    const source = this.viewSize();
    const target = this.canvasSize || source;
    return mapClientPoint(
      event.clientX,
      event.clientY,
      this.contentRect(),
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

    const point = this.pointFromEvent(event, true);
    if (!point) {
      return;
    }
    event.preventDefault();

    if (this.nextTouchId > 0xffff) {
      this.nextTouchId = 1;
    }
    const touch = { id: this.nextTouchId, ...point };
    this.nextTouchId += 1;
    this.pointers.set(event.pointerId, touch);
    this.onmarker({ visible: true, clientX: event.clientX, clientY: event.clientY });

    try {
      this.stage.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an optimization; the contact remains valid without it.
    }
    this.scheduleFlush();
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
    this.onmarker({ visible: true, clientX: event.clientX, clientY: event.clientY });
    this.scheduleFlush();
  }

  pointerEnd(event) {
    const active = this.pointers.get(event.pointerId);
    if (!active) {
      return;
    }
    this.pointers.delete(event.pointerId);
    this.resets.push(active.id);
    if (this.pointers.size === 0) {
      this.onmarker({ visible: false });
    }
    this.scheduleFlush();
  }

  scheduleFlush() {
    if (this.flushQueued) {
      return;
    }
    this.flushQueued = true;
    requestAnimationFrame(() => this.flush());
  }

  flush() {
    this.flushQueued = false;

    if (this.api?.connected) {
      if (this.resets.length > 0) {
        this.api.send('touch', 'write_reset', this.resets.splice(0));
      }
      if (this.pointers.size > 0) {
        const params = Array.from(this.pointers.values(), ({ id, x, y }) => [id, x, y]);
        this.api.send('touch', 'write', params, 'touch.write');
      }
    } else {
      this.resets.length = 0;
    }

    if (this.pointers.size > 0 && this.repeatTimer === null) {
      this.repeatTimer = setInterval(() => this.flush(), TouchController.REPEAT_MS);
    } else if (this.pointers.size === 0 && this.repeatTimer !== null) {
      clearInterval(this.repeatTimer);
      this.repeatTimer = null;
    }
  }

  releaseAll() {
    for (const point of this.pointers.values()) {
      this.resets.push(point.id);
    }
    this.pointers.clear();
    this.onmarker({ visible: false });
    this.flush();
  }
}
