export type DeleteMedicineReminderAdapter = {
  cancelNotifications: (identifiers: readonly string[]) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  listNotificationIds: (courseId: string) => Promise<readonly (string | null)[]>;
  queueCancellations: (identifiers: readonly string[]) => Promise<void>;
};

export async function deleteMedicineReminderWithAdapter(
  adapter: DeleteMedicineReminderAdapter,
  courseId: string,
): Promise<void> {
  const notificationIds = [
    ...new Set(
      (await adapter.listNotificationIds(courseId)).filter(
        (identifier): identifier is string => Boolean(identifier),
      ),
    ),
  ];

  await adapter.deleteCourse(courseId);

  if (notificationIds.length === 0) return;

  try {
    await adapter.cancelNotifications(notificationIds);
  } catch {
    await adapter.queueCancellations(notificationIds).catch(() => undefined);
  }
}
