export const MAX_PAGE_IMAGE_BYTES = 150 * 1024;

export function estimateBase64Bytes(base64: string): number {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (!cleaned) {
    return 0;
  }
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  return Math.floor((cleaned.length * 3) / 4) - padding;
}

export type ImagePageCompressor = (
  base64: string,
  options: { maxDimension: number; quality: number },
) => Promise<string>;

const COMPRESSION_ATTEMPTS: readonly {
  maxDimension: number;
  quality: number;
}[] = [
  { maxDimension: 1600, quality: 0.6 },
  { maxDimension: 1400, quality: 0.45 },
  { maxDimension: 1200, quality: 0.35 },
];

export async function compressPageIfNeeded(
  base64: string,
  compress: ImagePageCompressor,
): Promise<string> {
  if (estimateBase64Bytes(base64) <= MAX_PAGE_IMAGE_BYTES) {
    return base64;
  }

  let current = base64;
  for (const attempt of COMPRESSION_ATTEMPTS) {
    current = await compress(current, attempt);
    if (estimateBase64Bytes(current) <= MAX_PAGE_IMAGE_BYTES) {
      break;
    }
  }
  return current;
}
