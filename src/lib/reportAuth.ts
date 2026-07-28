import { supabase } from './supabase';
import {
  ensureReportSession,
  type ReportAuthAdapter,
} from './reportSession';

const supabaseReportAuth: ReportAuthAdapter = {
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    return {
      error,
      userId: data.user?.id ?? null,
    };
  },
  async signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();
    return {
      error,
      userId: data.user?.id ?? null,
    };
  },
};

export function ensureSecureReportSession(): Promise<string> {
  return ensureReportSession(supabaseReportAuth);
}
