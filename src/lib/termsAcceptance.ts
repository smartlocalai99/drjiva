import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

export const CURRENT_TERMS_VERSION = '2026-08-20';

// Best-effort — the on-device flag (session.ts) is the real gate; this just
// keeps a durable, per-device record of who agreed to what and when.
export async function recordTermsAcceptance(): Promise<void> {
  try {
    const ownerUserId = await ensureSecureReportSession();
    await supabase.from('terms_acceptance').upsert(
      { owner_user_id: ownerUserId, terms_version: CURRENT_TERMS_VERSION },
      { ignoreDuplicates: true, onConflict: 'owner_user_id,terms_version' },
    );
  } catch {
    // Never block login on this.
  }
}
