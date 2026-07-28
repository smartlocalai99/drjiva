export type DateMarker =
  | 'today-streak'
  | 'selected-gradient'
  | 'plain';

export function getDateMarker(
  isToday: boolean,
  isSelected: boolean,
): DateMarker {
  if (isToday) {
    return 'today-streak';
  }

  if (isSelected) {
    return 'selected-gradient';
  }

  return 'plain';
}
