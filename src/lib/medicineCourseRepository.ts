export type CourseRepositoryAdapter = {
  insertCourse: (course: Record<string, unknown>) => Promise<string>;
  insertEvents: (
    courseId: string,
    events: readonly Record<string, unknown>[],
  ) => Promise<void>;
  insertSlots: (courseId: string, slots: readonly string[]) => Promise<void>;
  removeCourse: (courseId: string) => Promise<void>;
};

export async function createCourseWithRepository(
  repository: CourseRepositoryAdapter,
  input: {
    course: Record<string, unknown>;
    events: readonly Record<string, unknown>[];
    slots: readonly string[];
  },
): Promise<string> {
  const courseId = await repository.insertCourse(input.course);
  try {
    await repository.insertSlots(courseId, input.slots);
    await repository.insertEvents(courseId, input.events);
    return courseId;
  } catch (error) {
    await repository.removeCourse(courseId).catch(() => undefined);
    throw error;
  }
}
