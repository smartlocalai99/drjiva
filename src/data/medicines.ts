export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  doctorName?: string;
  nextReminderTime: string;
  completed: boolean;
};

// No medicines backend exists yet — always empty until the real
// "Add Medicine" flow and a `medicines` table are wired up.
export function getMedicinesForDate(_date: Date): Medicine[] {
  return [];
}
