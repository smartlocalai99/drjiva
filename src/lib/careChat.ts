import { FunctionsHttpError } from '@supabase/supabase-js';

import type { CareChatMessage } from './care';
import type { AppLanguage } from './i18n';
import { toIndianE164 } from './phone';
import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

export type CareChatResult = {
  userMessage: CareChatMessage;
  reply: CareChatMessage;
  urgent: boolean;
  remainingToday: number;
};

export class CareChatError extends Error {
  constructor(public readonly code: 'daily_limit' | 'unavailable' | 'network') {
    super(code);
  }
}

// Sends one question to the care-chat edge function with this device's
// login. The function checks the device is linked to the number, keeps
// the 30-a-day limit, and saves both messages.
export async function sendCareChat(phone: string, message: string, language: AppLanguage): Promise<CareChatResult> {
  await ensureSecureReportSession();
  const { data, error } = await supabase.functions.invoke('care-chat', {
    body: { language, message, mobile: toIndianE164(phone) },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context instanceof Response ? error.context.status : 0;
      if (status === 429) throw new CareChatError('daily_limit');
      throw new CareChatError('unavailable');
    }
    throw new CareChatError('network');
  }
  return data as CareChatResult;
}
