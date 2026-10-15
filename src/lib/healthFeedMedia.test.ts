import { describe, expect, it } from 'vitest';

import { getHealthFeedMediaRenderMode } from './healthFeedMedia';

describe('getHealthFeedMediaRenderMode', () => {
  it('mounts a player only for the visible feed video', () => {
    expect(getHealthFeedMediaRenderMode('video', 'feed', true)).toBe('video');
    expect(getHealthFeedMediaRenderMode('video', 'feed', false)).toBe(
      'video-placeholder',
    );
  });

  it('never mounts a player for a video grid tile', () => {
    expect(getHealthFeedMediaRenderMode('video', 'grid', true)).toBe(
      'video-placeholder',
    );
    expect(getHealthFeedMediaRenderMode('video', 'grid', false)).toBe(
      'video-placeholder',
    );
  });

  it('keeps images renderable in feeds and grids', () => {
    expect(getHealthFeedMediaRenderMode('image', 'feed', true)).toBe('image');
    expect(getHealthFeedMediaRenderMode('image', 'grid', false)).toBe('image');
  });
});
