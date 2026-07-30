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

type NamedMedicine = {
  name: string;
};

export function hasMedicineImage<T extends { imageUrl?: string | null }>(
  medicine: T,
): boolean {
  return Boolean(medicine.imageUrl?.trim());
}

export function getNewCatalogueEntryName<T extends NamedMedicine>(
  entries: readonly T[],
  query: string,
): string | null {
  const displayName = query.trim().replace(/\s+/g, ' ');
  const normalizedQuery = normalizeMedicineSearch(displayName);
  if (displayName.length < 2 || !normalizedQuery) {
    return null;
  }

  const hasExactMatch = entries.some(
    (entry) => normalizeMedicineSearch(entry.name) === normalizedQuery,
  );
  return hasExactMatch ? null : displayName;
}

function medicineSearchRank(name: string, query: string): number {
  const normalizedName = normalizeMedicineSearch(name);
  if (normalizedName === query) {
    return 0;
  }
  if (normalizedName.startsWith(query)) {
    return 1;
  }
  if (normalizedName.split(' ').some((word) => word.startsWith(query))) {
    return 2;
  }
  return 3;
}

export function filterMedicineCatalogue<T extends NamedMedicine>(
  medicines: readonly T[],
  query: string,
  limit = 20,
): T[] {
  const normalizedQuery = normalizeMedicineSearch(query);
  const matches = normalizedQuery
    ? medicines.filter((medicine) =>
        matchesMedicineSearch(medicine.name, normalizedQuery),
      )
    : [...medicines];

  if (normalizedQuery) {
    matches.sort(
      (left, right) =>
        medicineSearchRank(left.name, normalizedQuery) -
        medicineSearchRank(right.name, normalizedQuery),
    );
  }

  return matches.slice(0, limit);
}
