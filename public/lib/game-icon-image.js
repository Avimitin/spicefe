import { CUSTOM_ICON_DATA_URL_LIMIT } from './custom-icon-store.js';

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const OUTPUT_SIZE = 384;

export class GameIconImageError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GameIconImageError';
    this.code = code;
  }
}

export function centeredSquareCrop(width, height) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
    throw new GameIconImageError('The selected image has no usable dimensions', 'decode');
  }
  const size = Math.min(sourceWidth, sourceHeight);
  return {
    x: (sourceWidth - size) / 2,
    y: (sourceHeight - size) / 2,
    size,
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const image = new Image();
    const rejectDecode = () => {
      reject(new GameIconImageError('The selected image could not be decoded', 'decode'));
    };
    image.onload = () => resolve(image);
    image.onerror = rejectDecode;
    reader.onerror = rejectDecode;
    reader.onload = () => {
      image.src = String(reader.result ?? '');
    };
    reader.readAsDataURL(file);
  });
}

function renderSquareDataUrl(image, size, quality) {
  const crop = centeredSquareCrop(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    throw new GameIconImageError('This browser cannot process the image', 'processing');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.clearRect(0, 0, size, size);
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.size,
    crop.size,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL('image/webp', quality);
}

export function customIconLabel(filename) {
  return String(filename ?? '')
    .replace(/\.[^.]+$/, '')
    .trim()
    .slice(0, 64) || 'Custom icon';
}

export async function gameIconDataUrl(file) {
  if (!file || !/^image\/(?:jpeg|png|webp)$/i.test(file.type || '')) {
    throw new GameIconImageError('Choose a PNG, JPEG, or WebP image', 'type');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new GameIconImageError('The selected image is larger than 12 MB', 'size');
  }

  const image = await loadImage(file);
  let dataUrl = renderSquareDataUrl(image, OUTPUT_SIZE, 0.86);
  if (dataUrl.length > CUSTOM_ICON_DATA_URL_LIMIT) {
    dataUrl = renderSquareDataUrl(image, 256, 0.76);
  }
  if (dataUrl.length > CUSTOM_ICON_DATA_URL_LIMIT) {
    throw new GameIconImageError('The image is too detailed to fit in browser storage', 'storage-size');
  }
  return dataUrl;
}
