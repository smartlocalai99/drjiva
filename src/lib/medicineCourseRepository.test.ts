import { describe, expect, it } from 'vitest';

import { createCourseWithRepository } from './medicineCourseRepository';

describe('createCourseWithRepository', () => {
  it('removes the course when child creation fails', async () => {
    const calls: string[] = [];

    await expect(
      createCourseWithRepository(
        {
          insertCourse: async () => {
            calls.push('course');
            return 'course-1';
          },
          insertEvents: async () => {
            calls.push('events');
            throw new Error('event failed');
          },
          insertSlots: async () => {
            calls.push('slots');
          },
          removeCourse: async () => {
            calls.push('rollback');
          },
        },
        { course: {}, events: [], slots: ['morning'] },
      ),
    ).rejects.toThrow('event failed');

    expect(calls).toEqual(['course', 'slots', 'events', 'rollback']);
  });
});
