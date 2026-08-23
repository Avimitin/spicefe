import { CARD_IMAGE_DATA_URL_LIMIT } from './card-store.js';

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_DIMENSION = 960;

export class CardImageError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CardImageError';
    this.code = code;
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new CardImageError('The selected image could not be decoded', 'decode'));
    };
    image.src = url;
  });
}

function renderDataUrl(image, maximum, quality) {
  const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#171717';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function cardImageDataUrl(file) {
  if (!file || !/^image\/(?:jpeg|png|webp)$/i.test(file.type || '')) {
    throw new CardImageError('Choose a PNG, JPEG, or WebP image', 'type');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new CardImageError('The selected image is larger than 12 MB', 'size');
  }

  const image = await loadImage(file);
  let dataUrl = renderDataUrl(image, MAX_DIMENSION, 0.84);
  if (dataUrl.length > CARD_IMAGE_DATA_URL_LIMIT) {
    dataUrl = renderDataUrl(image, 640, 0.72);
  }
  if (dataUrl.length > CARD_IMAGE_DATA_URL_LIMIT) {
    throw new CardImageError('The image is too detailed to fit in browser storage', 'storage-size');
  }
  return dataUrl;
}
