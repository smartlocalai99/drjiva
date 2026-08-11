import { supabase } from './supabase';

export type HealthFeedDoctor = {
  avatar_url: string;
  bio: string;
  display_name: string;
  experience_years: number;
  hospital_name: string;
  phone_number: string;
  specialty: string;
  verification_status: 'pending' | 'verified' | 'rejected';
};

export type HealthFeedPost = {
  caption: string;
  comments_count: number;
  created_at: string;
  doctor: HealthFeedDoctor;
  doctor_phone: string;
  hashtags: string[];
  id: string;
  likes_count: number;
  media_type: 'image' | 'video';
  media_url: string;
  published_at: string;
  safety_note: string | null;
  source_url: string | null;
  title: string;
  views_count: number;
};

export async function fetchHealthFeed(): Promise<HealthFeedPost[]> {
  const { data, error } = await supabase
    .from('health_posts')
    .select(`
      id,
      doctor_phone,
      title,
      caption,
      hashtags,
      media_type,
      media_url,
      safety_note,
      source_url,
      views_count,
      likes_count,
      comments_count,
      published_at,
      created_at,
      doctor:doctors!health_posts_doctor_phone_fkey(
        phone_number,
        display_name,
        specialty,
        hospital_name,
        experience_years,
        bio,
        avatar_url,
        verification_status
      )
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data || []) as unknown as HealthFeedPost[];
}

export function subscribeToPublishedHealthPosts(onChange: () => void) {
  const channel = supabase
    .channel('published-health-posts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        filter: 'status=eq.published',
        schema: 'public',
        table: 'health_posts',
      },
      onChange,
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
