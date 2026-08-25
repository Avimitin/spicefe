const GIBIBYTE = 1024 ** 3;

export function memoryPresentation(memory, locale = 'en') {
  const totalBytes = Number(memory?.totalBytes);
  const usedBytes = Number(memory?.usedBytes);
  if (!Number.isFinite(totalBytes)
    || !Number.isFinite(usedBytes)
    || totalBytes <= 0
    || usedBytes < 0
    || usedBytes > totalBytes) {
    return null;
  }

  const size = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  return {
    percent: Math.round((usedBytes / totalBytes) * 100),
    used: `${size.format(usedBytes / GIBIBYTE)} GiB`,
    total: `${size.format(totalBytes / GIBIBYTE)} GiB`,
  };
}
