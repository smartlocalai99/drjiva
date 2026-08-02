export type DeleteMedicineReminderAdapter = {
  cancelNotifications: (identifiers: readonly string[]) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  filterUnusedNotificationIds?: (
    identifiers: readonly string[],
  ) => Promise<readonly string[]>;
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

  const unusedNotificationIds = adapter.filterUnusedNotificationIds
    ? await adapter.filterUnusedNotificationIds(notificationIds)
    : notificationIds;
  if (unusedNotificationIds.length === 0) return;

  try {
    await adapter.cancelNotifications(unusedNotificationIds);
  } catch {
    await adapter
      .queueCancellations(unusedNotificationIds)
      .catch(() => undefined);
  }
}
