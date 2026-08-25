import qrcode from '../vendor/qrcode-generator/qrcode.js';

export class QrCodeError extends Error {
  constructor(message, code = 'qr') {
    super(message);
    this.name = 'QrCodeError';
    this.code = code;
  }
}

export function createQrCodeSvg(value, options = {}) {
  const text = String(value ?? '');
  if (!text) {
    throw new QrCodeError('QR code content is required', 'empty');
  }

  try {
    const code = qrcode(0, options.errorCorrectionLevel || 'M');
    code.addData(text, 'Byte');
    code.make();
    return code.createSvgTag({
      cellSize: options.cellSize || 4,
      margin: options.margin ?? 16,
      scalable: true,
      title: options.title,
      alt: options.alt,
    });
  } catch {
    throw new QrCodeError('The connection link is too large for a QR code', 'capacity');
  }
}
