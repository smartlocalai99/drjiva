import { beforeEach, describe, expect, it, vi } from 'vitest';

const { channelMock, commentInsertMock, ensureSessionMock, fromMock, removeChannelMock, rpcMock, upsertMock } = vi.hoisted(() => ({
  channelMock: vi.fn(),
  commentInsertMock: vi.fn(),
  ensureSessionMock: vi.fn(async () => 'patient-user-id'),
  fromMock: vi.fn(),
  removeChannelMock: vi.fn(),
  rpcMock: vi.fn(),
  upsertMock: vi.fn(async () => ({ error: null })),
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: ensureSessionMock,
}));

vi.mock('./supabase', () => ({
  supabase: {
    channel: channelMock,
    from: fromMock,
    removeChannel: removeChannelMock,
    rpc: rpcMock,
  },
}));

import {
  blockCommentAuthor,
  createHealthPostComment,
  deleteHealthPostComment,
  fetchBlockedOwnerIds,
  fetchHealthPostComments,
  fetchHealthFeedViewerState,
  recordHealthPostView,
  reportHealthPost,
  reportHealthPostComment,
  setHealthPostLike,
  shuffleHealthFeedPosts,
  subscribeToPublishedHealthPosts,
} from './healthFeed';

describe('Health Feed interactions', () => {
  beforeEach(() => {
    ensureSessionMock.mockClear();
    fromMock.mockReset();
    channelMock.mockReset();
    removeChannelMock.mockReset();
    rpcMock.mockReset();
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

  it('records every qualified view through the atomic database function', async () => {
    rpcMock.mockResolvedValue({ data: 12, error: null });

    await expect(recordHealthPostView('post-1')).resolves.toEqual({ count: 12 });
    expect(ensureSessionMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('record_health_post_view', { p_post_id: 'post-1' });
  });

  it('patches post updates live without refetching the full feed', () => {
    const handlers: Array<{ event: string; handler: (payload: { new: Record<string, unknown> }) => void }> = [];
    const channel = {
      on: vi.fn((_: string, filter: { event: string }, handler: (payload: { new: Record<string, unknown> }) => void) => {
        handlers.push({ event: filter.event, handler });
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    channelMock.mockReturnValue(channel);
    const onFeedStructureChange = vi.fn();
    const onPostUpdate = vi.fn();

    const unsubscribe = subscribeToPublishedHealthPosts({ onFeedStructureChange, onPostUpdate });
    handlers.find(({ event }) => event === 'UPDATE')?.handler({ new: { id: 'post-1', views_count: 18 } });
    handlers.find(({ event }) => event === 'INSERT')?.handler({ new: { id: 'post-2' } });

    expect(onPostUpdate).toHaveBeenCalledWith({ id: 'post-1', views_count: 18 });
    expect(onFeedStructureChange).toHaveBeenCalledOnce();
    unsubscribe();
    expect(removeChannelMock).toHaveBeenCalledWith(channel);
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
        owner_user_id: 'patient-user-id',
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

  it('excludes comments from blocked authors', async () => {
    const blockedEqMock = vi.fn(async () => ({
      data: [{ blocked_owner_user_id: 'blocked-user-id' }],
      error: null,
    }));
    const limitMock = vi.fn(async () => ({
      data: [
        {
          author_name: 'Anita',
          body: 'Kept',
          created_at: '2026-08-11T12:00:00.000Z',
          id: 'comment-kept',
          owner_user_id: 'patient-user-id',
          post_id: 'post-1',
        },
        {
          author_name: 'Rahul',
          body: 'Hidden',
          created_at: '2026-08-11T12:01:00.000Z',
          id: 'comment-hidden',
          owner_user_id: 'blocked-user-id',
          post_id: 'post-1',
        },
      ],
      error: null,
    }));
    fromMock.mockImplementation((table: string) => {
      if (table === 'blocked_users') return { select: () => ({ eq: blockedEqMock }) };
      if (table === 'health_post_comments') {
        return { select: () => ({ eq: () => ({ order: () => ({ limit: limitMock }) }) }) };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const comments = await fetchHealthPostComments('post-1');

    expect(comments).toHaveLength(1);
    expect(comments[0]?.id).toBe('comment-kept');
  });

  it('files a report tied to the reporting patient', async () => {
    const insertMock = vi.fn(async () => ({ error: null }));
    fromMock.mockImplementation((table: string) => {
      if (table === 'content_reports') return { insert: insertMock };
      throw new Error(`Unexpected table ${table}`);
    });

    await reportHealthPost('post-1', 'spam', 'Looks like an ad');

    expect(insertMock).toHaveBeenCalledWith({
      description: 'Looks like an ad',
      post_id: 'post-1',
      reason: 'spam',
      reporter_owner_user_id: 'patient-user-id',
      target_type: 'post',
    });
  });

  it('reports a specific comment', async () => {
    const insertMock = vi.fn(async () => ({ error: null }));
    fromMock.mockImplementation((table: string) => {
      if (table === 'content_reports') return { insert: insertMock };
      throw new Error(`Unexpected table ${table}`);
    });

    await reportHealthPostComment('post-1', 'comment-1', 'harassment');

    expect(insertMock).toHaveBeenCalledWith({
      comment_id: 'comment-1',
      description: null,
      post_id: 'post-1',
      reason: 'harassment',
      reporter_owner_user_id: 'patient-user-id',
      target_type: 'comment',
    });
  });

  it('reads blocked owner ids for the current patient', async () => {
    const eqMock = vi.fn(async () => ({
      data: [{ blocked_owner_user_id: 'blocked-1' }, { blocked_owner_user_id: 'blocked-2' }],
      error: null,
    }));
    fromMock.mockImplementation((table: string) => {
      if (table === 'blocked_users') return { select: () => ({ eq: eqMock }) };
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(fetchBlockedOwnerIds()).resolves.toEqual(['blocked-1', 'blocked-2']);
    expect(eqMock).toHaveBeenCalledWith('blocker_owner_user_id', 'patient-user-id');
  });

  it('blocking a comment author also files a report for the offending comment', async () => {
    const blockUpsertMock = vi.fn(async () => ({ error: null }));
    const reportInsertMock = vi.fn(async () => ({ error: null }));
    fromMock.mockImplementation((table: string) => {
      if (table === 'blocked_users') return { upsert: blockUpsertMock };
      if (table === 'content_reports') return { insert: reportInsertMock };
      throw new Error(`Unexpected table ${table}`);
    });

    await blockCommentAuthor('blocked-user-id', 'post-1', 'comment-1');

    expect(blockUpsertMock).toHaveBeenCalledWith(
      { blocked_owner_user_id: 'blocked-user-id', blocker_owner_user_id: 'patient-user-id' },
      { ignoreDuplicates: true, onConflict: 'blocker_owner_user_id,blocked_owner_user_id' },
    );
    expect(reportInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        comment_id: 'comment-1',
        post_id: 'post-1',
        reason: 'harassment',
        target_type: 'comment',
      }),
    );
  });
});

describe('shuffleHealthFeedPosts', () => {
  it('returns every item exactly once, without mutating the input', () => {
    const posts = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = shuffleHealthFeedPosts(posts);

    expect(shuffled).toHaveLength(posts.length);
    expect([...shuffled].sort()).toEqual([...posts].sort());
    expect(posts).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('produces a different order across many shuffles of a larger list', () => {
    const posts = Array.from({ length: 30 }, (_, i) => `post-${i}`);
    const results = new Set(
      Array.from({ length: 20 }, () => shuffleHealthFeedPosts(posts).join(',')),
    );

    expect(results.size).toBeGreaterThan(1);
  });
});
