// Deno Edge Function — "Ask DrJiva" chat on the My Care page.
//
// The app calls this with the patient's own login (device session).
// All checks happen in the database with that login: the device must be
// linked to the mobile number, and the 30-questions-a-day limit is kept.
// The AI only gets: medicine names + times, hospital, department,
// pregnancy week or child age, next visit date, pending items and the
// last ~10 messages. Never the mobile number or names.
//
// Free AI, no paid key needed:
//   1. Google Gemini free tier (secret GEMINI_API_KEY, free key from
//      aistudio.google.com): models in GEMINI_MODELS, first one that answers.
//   2. Otherwise Pollinations' free, keyless text API.
// If neither answers, the patient gets a safe "try again" reply.
import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

import {
  buildContextNote,
  CARE_CHAT_SYSTEM_PROMPT,
  detectDangerSigns,
  enforceSafetyLines,
  type CareChatContext,
  type ChatLanguage,
} from '../_shared/careChatSafety.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
// Fast free model first; the bigger one when the first is busy.
const GEMINI_MODELS = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-flash-lite-latest,gemini-flash-latest')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const SYSTEM_PROMPT = `${CARE_CHAT_SYSTEM_PROMPT}

Write only the reply the patient will read: plain text, no JSON, no "urgent" field, no notes about these rules.`;

const BUSY = {
  en: 'Sorry, I am busy right now. Please ask again in a minute. For anything urgent, call your hospital or 108.',
  te: 'క్షమించండి, ఇప్పుడు బిజీగా ఉన్నాను. ఒక నిమిషం తర్వాత మళ్ళీ అడగండి. అత్యవసరమైతే మీ హాస్పిటల్‌కు లేదా 108కి కాల్ చేయండి.',
} as const;

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

type Turn = { role: 'user' | 'assistant'; content: string };

type BeginResult = {
  messageId: string;
  remainingToday: number;
  history: Turn[];
  context: CareChatContext;
};

// Alternating turns ending with the new question (with the context note).
function buildTurns(history: Turn[], contextNote: string, question: string, language: ChatLanguage): Turn[] {
  const turns: Turn[] = [];
  for (const entry of history.slice(-10)) {
    const last = turns[turns.length - 1];
    if (last && last.role === entry.role) last.content = `${last.content}\n${entry.content}`;
    else turns.push({ content: entry.content, role: entry.role });
  }
  while (turns.length && turns[0]!.role !== 'user') turns.shift();
  const reply = language === 'te' ? 'Reply in simple Telugu.' : 'Reply in simple English.';
  const current = `Patient context:\n${contextNote}\n\n${reply}\n\nPatient's message:\n${question}`;
  const last = turns[turns.length - 1];
  if (last && last.role === 'user') last.content = `${last.content}\n\n${current}`;
  else turns.push({ content: current, role: 'user' });
  return turns;
}

function clean(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const reply = text.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim();
  return reply ? reply.slice(0, 1500) : null;
}

async function askGemini(turns: Turn[]): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;
  // A busy answer (503/429) is usually gone a moment later: the first
  // model gets one quick retry before moving on.
  const attempts = GEMINI_MODELS.length ? [GEMINI_MODELS[0]!, ...GEMINI_MODELS] : [];
  for (const [index, model] of attempts.entries()) {
    if (index === 1) await new Promise((resolve) => setTimeout(resolve, 1_500));
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        body: JSON.stringify({
          contents: turns.map((turn) => ({ parts: [{ text: turn.content }], role: turn.role === 'assistant' ? 'model' : 'user' })),
          generationConfig: { maxOutputTokens: 800, temperature: 0.3 },
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        }),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        method: 'POST',
        signal: AbortSignal.timeout(12_000),
      });
      if (response.ok) {
        const data = await response.json();
        const reply = clean(data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join(''));
        if (reply) return reply;
      } else {
        // 429 / 503 = busy: try the next model.
        console.error('[care-chat] Gemini', model, response.status, (await response.text()).slice(0, 200));
      }
    } catch (error) {
      console.error('[care-chat] Gemini failed', model, error);
    }
  }
  return null;
}

async function askPollinations(turns: Turn[]): Promise<string | null> {
  // Last resort: keyless and slow, so one short try (plus one retry when
  // it says "too many requests").
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(POLLINATIONS_URL, {
        body: JSON.stringify({
          messages: [{ content: SYSTEM_PROMPT, role: 'system' }, ...turns],
          model: 'openai',
          private: true,
          referrer: 'drjiva',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
      });
      if (response.ok) {
        const data = await response.json();
        return clean(data?.choices?.[0]?.message?.content);
      }
      console.error('[care-chat] Pollinations', response.status, (await response.text()).slice(0, 200));
      if (response.status !== 429) return null;
    } catch (error) {
      console.error('[care-chat] Pollinations failed', error);
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'not_signed_in' }, 401);

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

  const turns = buildTurns(begin.history ?? [], buildContextNote(begin.context), message, language);
  const answer = (await askGemini(turns)) ?? (await askPollinations(turns));
  const urgent = flags.urgent || Boolean(answer && /\b108\b/.test(answer.split('\n')[0] ?? ''));
  const reply = enforceSafetyLines(answer ?? BUSY[language], { selfHarm: flags.selfHarm, urgent }, language);

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
