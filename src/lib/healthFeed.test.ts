import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureSessionMock, fromMock, upsertMock, commentInsertMock } = vi.hoisted(() => ({
  ensureSessionMock: vi.fn(async () => 'patient-user-id'),
  fromMock: vi.fn(),
  upsertMock: vi.fn(async () => ({ error: null })),
  commentInsertMock: vi.fn(),
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: ensureSessionMock,
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  createHealthPostComment,
  deleteHealthPostComment,
  fetchHealthPostComments,
  fetchHealthFeedViewerState,
  setHealthPostLike,
} from './healthFeed';

describe('Health Feed interactions', () => {
  beforeEach(() => {
    ensureSessionMock.mockClear();
    fromMock.mockReset();
    upsertMock.mockClear();
    commentInsertMock.mockReset();
  });

  it('loads the current patient’s likes, saves, and followed doctors', async () => {
    const rows = {
      health_post_likes: [{ post_id: 'post-liked' }],
      health_post_saves: [{ post_id: 'post-saved' }],
      health_doctor_follows: [{ doctor_phone: '+919866531011' }],
    };
    fromMock.mockImplementation((table: keyof typeof rows) => ({
      select: () => ({
        eq: async () => ({ data: rows[table], error: null }),
      }),
    }));

    await expect(fetchHealthFeedViewerState()).resolves.toEqual({
      followedDoctorPhones: ['+919866531011'],
      likedPostIds: ['post-liked'],
      savedPostIds: ['post-saved'],
    });
    expect(ensureSessionMock).toHaveBeenCalledOnce();
  });

  it('persists a like with the authenticated owner and returns the trigger count', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'health_post_likes') return { upsert: upsertMock };
      if (table === 'health_posts') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { likes_count: 7 }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(setHealthPostLike('post-1', true)).resolves.toEqual({ count: 7 });
    expect(upsertMock).toHaveBeenCalledWith(
      { owner_user_id: 'patient-user-id', post_id: 'post-1' },
      { ignoreDuplicates: true, onConflict: 'post_id,owner_user_id' },
    );
  });

  it('trims comments and returns the synchronized comment count', async () => {
    const comment = {
      author_name: 'Anita',
      body: 'Very helpful.',
      created_at: '2026-08-11T12:00:00.000Z',
      id: 'comment-1',
      owner_user_id: 'patient-user-id',
      post_id: 'post-1',
    };
    const commentSingle = vi.fn(async () => ({ data: comment, error: null }));
    commentInsertMock.mockReturnValue({
      select: () => ({ single: commentSingle }),
    });
    fromMock.mockImplementation((table: string) => {
      if (table === 'health_post_comments') return { insert: commentInsertMock };
      if (table === 'health_posts') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { comments_count: 3 }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      createHealthPostComment('post-1', '  Anita  ', '  Very helpful.  '),
    ).resolves.toEqual({
      comment: {
        author_name: 'Anita',
        body: 'Very helpful.',
        created_at: '2026-08-11T12:00:00.000Z',
        id: 'comment-1',
        is_owner: true,
        post_id: 'post-1',
      },
      count: 3,
    });
    expect(commentInsertMock).toHaveBeenCalledWith({
      author_name: 'Anita',
      body: 'Very helpful.',
      owner_user_id: 'patient-user-id',
      post_id: 'post-1',
    });
  });

  it('marks only the signed-in patient’s comments as owned', async () => {
    const limitMock = vi.fn(async () => ({
      data: [
        {
          author_name: 'Anita',
          body: 'My comment',
          created_at: '2026-08-11T12:00:00.000Z',
          id: 'comment-owned',
          owner_user_id: 'patient-user-id',
          post_id: 'post-1',
        },
        {
          author_name: 'Rahul',
          body: 'Another comment',
          created_at: '2026-08-11T12:01:00.000Z',
          id: 'comment-other',
          owner_user_id: 'another-user-id',
          post_id: 'post-1',
        },
      ],
      error: null,
    }));
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: limitMock }),
        }),
      }),
    });

    await expect(fetchHealthPostComments('post-1')).resolves.toMatchObject([
      { id: 'comment-owned', is_owner: true },
      { id: 'comment-other', is_owner: false },
    ]);
  });

  it('deletes only the authenticated patient’s comment and returns the new count', async () => {
    const maybeSingleMock = vi.fn(async () => ({ data: { id: 'comment-1' }, error: null }));
    const ownerEqMock = vi.fn(() => ({ select: () => ({ maybeSingle: maybeSingleMock }) }));
    const postEqMock = vi.fn(() => ({ eq: ownerEqMock }));
    const idEqMock = vi.fn(() => ({ eq: postEqMock }));
    const deleteMock = vi.fn(() => ({ eq: idEqMock }));

    fromMock.mockImplementation((table: string) => {
      if (table === 'health_post_comments') return { delete: deleteMock };
      if (table === 'health_posts') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { comments_count: 1 }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(deleteHealthPostComment('post-1', 'comment-1')).resolves.toEqual({ count: 1 });
    expect(idEqMock).toHaveBeenCalledWith('id', 'comment-1');
    expect(postEqMock).toHaveBeenCalledWith('post_id', 'post-1');
    expect(ownerEqMock).toHaveBeenCalledWith('owner_user_id', 'patient-user-id');
  });
});
