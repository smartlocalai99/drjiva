export function normalizeMedicineSearch(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchesMedicineSearch(name: string, query: string): boolean {
  const normalizedName = normalizeMedicineSearch(name);
  const normalizedQuery = normalizeMedicineSearch(query);
  if (!normalizedQuery) {
    return true;
  }
  return normalizedQuery
    .split(' ')
    .every((token) => normalizedName.includes(token));
}
