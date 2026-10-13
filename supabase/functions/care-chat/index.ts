// Deno Edge Function — "Ask DrJiva" after-hospital care chat.
//
// The app calls this with the patient's own login (device session).
// All checks happen in the database with that login: the device must be
// linked to the mobile number, and the 30-questions-a-day limit is kept.
// The AI only gets: medicine names + times, hospital, department,
// pregnancy week or child age, next visit date, pending items and the
// last ~10 messages. Never the mobile number or names.
//
// Needs one secret: supabase secrets set ANTHROPIC_API_KEY=...
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.133.0/helpers/zod';
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import { z } from 'npm:zod@4.6.5';

import {
  buildContextNote,
  CARE_CHAT_SYSTEM_PROMPT,
  detectDangerSigns,
  enforceSafetyLines,
  fallbackReply,
  type CareChatContext,
  type ChatLanguage,
} from '../_shared/careChatSafety.ts';

const MODEL = 'claude-haiku-5-5';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

const ReplySchema = z.object({
  reply: z.string(),
  urgent: z.boolean(),
});

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 }) : null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

type BeginResult = {
  messageId: string;
  remainingToday: number;
  history: { role: 'user' | 'assistant'; content: string }[];
  context: CareChatContext;
};

// Turns stored history into alternating turns ending with the new
// question (the API needs user/assistant to alternate).
function buildMessages(history: BeginResult['history'], contextNote: string, question: string): Anthropic.MessageParam[] {
  const turns: Anthropic.MessageParam[] = [];
  for (const entry of history) {
    const last = turns[turns.length - 1];
    if (last && last.role === entry.role) {
      last.content = `${last.content as string}\n${entry.content}`;
    } else {
      turns.push({ content: entry.content, role: entry.role });
    }
  }
  while (turns.length && turns[0]!.role !== 'user') turns.shift();
  const current = `Patient context:\n${contextNote}\n\nPatient's message:\n${question}`;
  const last = turns[turns.length - 1];
  if (last && last.role === 'user') {
    last.content = `${last.content as string}\n\n${current}`;
  } else {
    turns.push({ content: current, role: 'user' });
  }
  return turns;
}

async function askClaude(begin: BeginResult, question: string): Promise<{ reply: string; urgent: boolean } | null> {
  if (!anthropic) return null;
  try {
    const response = await anthropic.messages.parse({
      max_tokens: 2048,
      messages: buildMessages(begin.history, buildContextNote(begin.context), question),
      model: MODEL,
      output_config: { effort: 'low', format: zodOutputFormat(ReplySchema) },
      system: CARE_CHAT_SYSTEM_PROMPT,
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
    const reply = response.parsed_output.reply.trim();
    return reply ? { reply, urgent: response.parsed_output.urgent } : null;
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error('[care-chat] Claude API error', error.status, error.message);
    } else {
      console.error('[care-chat] Claude call failed', error);
    }
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'not_signed_in' }, 401);
  if (!anthropic) return json({ error: 'chat_not_configured' }, 503);

  let body: { mobile?: unknown; message?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }
  const mobile = typeof body.mobile === 'string' ? body.mobile : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const language: ChatLanguage = body.language === 'te' ? 'te' : 'en';
  if (!mobile || !message || message.length > 1000) return json({ error: 'invalid_message' }, 400);

  // Every database call runs as the patient's own device login.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data: beginData, error: beginError } = await supabase.rpc('care_chat_begin', { p_message: message, p_mobile: mobile });
  if (beginError) {
    if (beginError.message === 'daily_limit') return json({ error: 'daily_limit' }, 429);
    if (beginError.code === '42501' || beginError.code === '28000') return json({ error: 'not_linked' }, 403);
    console.error('[care-chat] begin failed', beginError);
    return json({ error: 'unavailable' }, 500);
  }
  const begin = beginData as BeginResult;
  const flags = detectDangerSigns(message, begin.context);

  const answer = await askClaude(begin, message);
  const urgent = flags.urgent || Boolean(answer?.urgent);
  const reply = answer
    ? enforceSafetyLines(answer.reply, { selfHarm: flags.selfHarm, urgent }, language)
    : fallbackReply(language, begin.context?.hospital, { selfHarm: flags.selfHarm, urgent });

  const { data: saved, error: finishError } = await supabase.rpc('care_chat_finish', {
    p_message_id: begin.messageId,
    p_mobile: mobile,
    p_reply: reply,
    p_urgent: urgent,
  });
  if (finishError) {
    console.error('[care-chat] finish failed', finishError);
    return json({ error: 'unavailable' }, 500);
  }

  return json({
    remainingToday: begin.remainingToday,
    reply: saved,
    urgent,
    userMessage: {
      content: message,
      createdAt: new Date().toISOString(),
      id: begin.messageId,
      role: 'user',
      urgent,
    },
  });
});
