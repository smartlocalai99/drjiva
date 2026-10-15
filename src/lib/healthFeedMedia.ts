export type HealthFeedMediaPresentation = 'feed' | 'grid';
export type HealthFeedMediaRenderMode =
  | 'image'
  | 'video'
  | 'video-placeholder';

export function getHealthFeedMediaRenderMode(
  mediaType: 'image' | 'video',
  presentation: HealthFeedMediaPresentation,
  isVisible: boolean,
): HealthFeedMediaRenderMode {
  if (mediaType === 'image') return 'image';
  return presentation === 'feed' && isVisible
    ? 'video'
    : 'video-placeholder';
}
