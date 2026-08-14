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

export type MedicineSearchResult<T> = {
  items: T[];
  usedNearestFallback: boolean;
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

function adjacentEditDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const rows = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  for (let row = 0; row <= left.length; row += 1) rows[row]![0] = row;
  for (let column = 0; column <= right.length; column += 1) {
    rows[0]![column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row]![column] = Math.min(
        rows[row - 1]![column]! + 1,
        rows[row]![column - 1]! + 1,
        rows[row - 1]![column - 1]! + substitutionCost,
      );
      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        rows[row]![column] = Math.min(
          rows[row]![column]!,
          rows[row - 2]![column - 2]! + 1,
        );
      }
    }
  }

  return rows[left.length]![right.length]!;
}

function nearestSearchScore(searchable: string, query: string): number {
  const searchableTokens = normalizeMedicineSearch(searchable).split(' ');
  const queryTokens = query.split(' ');
  return queryTokens.reduce((total, queryToken) => {
    const closestTokenScore = searchableTokens.reduce(
      (closest, searchableToken) => {
        const distance = adjacentEditDistance(queryToken, searchableToken);
        const normalizedDistance =
          distance / Math.max(queryToken.length, searchableToken.length, 1);
        return Math.min(closest, normalizedDistance);
      },
      Number.POSITIVE_INFINITY,
    );
    return total + closestTokenScore;
  }, 0) / Math.max(queryTokens.length, 1);
}

export function searchMedicineCatalogue<T extends NamedMedicine>(
  medicines: readonly T[],
  query: string,
  limit = 20,
  getSearchText: (medicine: T) => string = (medicine) => medicine.name,
): MedicineSearchResult<T> {
  const normalizedQuery = normalizeMedicineSearch(query);
  if (!normalizedQuery) {
    return {
      items: medicines.slice(0, limit),
      usedNearestFallback: false,
    };
  }

  const directMatches = medicines.filter((medicine) =>
    matchesMedicineSearch(getSearchText(medicine), normalizedQuery),
  );
  if (directMatches.length > 0) {
    return {
      items: directMatches
        .sort(
          (left, right) =>
            medicineSearchRank(left.name, normalizedQuery) -
              medicineSearchRank(right.name, normalizedQuery) ||
            left.name.localeCompare(right.name),
        )
        .slice(0, limit),
      usedNearestFallback: false,
    };
  }

  const scoredMedicines = medicines.map((medicine, index) => ({
    index,
    medicine,
    score: nearestSearchScore(getSearchText(medicine), normalizedQuery),
  }));

  return {
    items: scoredMedicines
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.medicine.name.localeCompare(right.medicine.name) ||
          left.index - right.index,
      )
      .slice(0, limit)
      .map(({ medicine }) => medicine),
    usedNearestFallback: true,
  };
}

export function filterMedicineCatalogue<T extends NamedMedicine>(
  medicines: readonly T[],
  query: string,
  limit = 20,
): T[] {
  return searchMedicineCatalogue(medicines, query, limit).items;
}
