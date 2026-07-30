export function formatRupees(value: number): string {
  if (!Number.isFinite(value)) {
    return '₹0';
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return `₹${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}`;
}
