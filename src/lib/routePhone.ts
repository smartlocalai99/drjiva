export function normalizeRoutePhone(
  value: string | string[] | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return (candidate ?? '').replace(/\D/g, '').slice(-10);
}
