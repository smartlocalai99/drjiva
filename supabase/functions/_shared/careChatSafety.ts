// Safety net for the care-chat edge function. The model is told the
// danger signs too; this deterministic check makes sure the urgent
// buttons and the 108 / Tele MANAS lines appear even if the model
// misses one. English, Telugu script, and Telugu typed in English.

export type ChatLanguage = 'en' | 'te';

export type CareChatContext = {
  today?: string;
  hospital?: string | null;
  department?: string;
  medicines?: { name: string; times: string[] }[];
  pregnancyWeek?: number | null;
  children?: { age: string }[];
  nextFollowupDate?: string | null;
  pendingItems?: string[];
  // Active fertility treatment (OI-TI / IUI): day 1 = first day of her period.
  cycle?: {
    treatment?: string;
    day1?: string;
    dayOfCycle?: number;
    steps?: { date: string; day: number; step: string; who: 'wife' | 'husband' | 'couple'; done: boolean }[];
  } | null;
};

const DANGER_PHRASES: readonly string[] = [
  // General
  'chest pain', 'chest is paining', 'heart pain', 'ఛాతీ నొప్పి', 'ఛాతి నొప్పి', 'చాతీ నొప్పి', 'చాతి నొప్పి', 'గుండె నొప్పి', 'chaati noppi', 'chathi noppi', 'chati noppi', 'gunde noppi',
  'breathless', 'cannot breathe', "can't breathe", 'cant breathe', 'short of breath', 'difficulty breathing', 'breathing difficulty', 'ఊపిరి ఆడట్లేదు', 'ఊపిరి ఆడటం లేదు', 'శ్వాస ఆడట్లేదు', 'upiri adatledu', 'oopiri adatledu', 'swasa adatledu',
  'fainted', 'fainting', 'unconscious', 'passed out', 'స్పృహ కోల్పోయ', 'స్పృహ లేదు', 'spruha ledu', 'spruha kolpoy',
  'fits', 'seizure', 'convulsion', 'మూర్ఛ', 'murcha', 'moorcha',
  'stroke', 'face drooping', 'slurred speech', 'one side weak', 'paralysis', 'పక్షవాతం', 'pakshavatam',
  'heavy bleeding', 'bleeding', 'blood coming', 'రక్తస్రావం', 'రక్తం కారుతోంది', 'రక్తం వస్తోంది', 'rakthasravam', 'raktasravam', 'raktham vastundi', 'raktam vastundi', 'raktham karutondi',
  'severe stomach pain', 'severe abdominal pain', 'unbearable stomach pain', 'తీవ్రమైన కడుపు నొప్పి', 'భరించలేని కడుపు నొప్పి', 'bharinchaleni kadupu noppi',
  'vomiting blood', 'blood vomit', 'blood in vomit', 'black stool', 'black motion', 'black poop', 'రక్తపు వాంతి', 'రక్తం వాంతి', 'నల్లటి మలం', 'నల్ల మలం', 'raktham vanthi', 'raktam vanti', 'nalla motion',
  'high fever', 'fever not coming down', 'fever not reducing', 'fever is not going', 'జ్వరం తగ్గట్లేదు', 'జ్వరం తగ్గడం లేదు', 'jwaram taggatledu', 'jvaram taggatledu', 'jwaram thaggatledu',
  'pus', 'wound opened', 'wound is open', 'stitches opened', 'stitches came', 'చీము', 'కుట్లు ఊడిపోయ', 'కుట్లు విడిపోయ', 'cheemu', 'kutlu oodipoy', 'kutlu vidipoy',
  'face swelling', 'swollen face', 'lip swelling', 'lips swelling', 'swollen lips', 'ముఖం వాపు', 'పెదవుల వాపు', 'పెదాలు వాచ', 'mukham vapu', 'pedavulu vapu',
  // Pregnancy
  'water leaking', 'water broke', 'leaking water', 'నీరు కారుతోంది', 'నీళ్లు పోతున్నాయి', 'neeru karutondi', 'neellu potunnayi',
  'baby not moving', 'baby moving less', 'less baby movement', 'no baby movement', 'బిడ్డ కదలడం లేదు', 'కదలికలు తగ్గాయి', 'bidda kadalatledu', 'baby kadalatledu',
  'severe headache', 'blurred vision', 'blurry vision', 'sudden swelling', 'తీవ్రమైన తలనొప్పి', 'చూపు మసకగా', 'chupu masakaga',
  // Child
  'not feeding', 'not drinking milk', 'not taking feed', 'పాలు తాగట్లేదు', 'పాలు తాగడం లేదు', 'palu tagatledu', 'paalu taagatledu',
  'very sleepy', 'hard to wake', 'not waking up', 'too sleepy', 'lethargic',
  'fast breathing', 'breathing fast', 'వేగంగా ఊపిరి', 'vegamga swasa',
  'no urine', 'not passing urine', 'dry mouth', 'sunken eyes', 'dehydrat', 'మూత్రం రావట్లేదు', 'muthram ravatledu',
];

const SELF_HARM_PHRASES: readonly string[] = [
  'suicide', 'kill myself', 'end my life', 'want to die', 'self harm', 'self-harm', 'hurt myself',
  'ఆత్మహత్య', 'చనిపోవాలని', 'బ్రతకాలని లేదు', 'athmahatya', 'aatmahatya', 'chanipovalani', 'bratakalani ledu', 'brathakalani ledu',
];

const FEVER_WORDS: readonly string[] = ['fever', 'జ్వరం', 'jwaram', 'jvaram', 'temperature'];

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
}

function hasPhrase(normalized: string, phrase: string): boolean {
  const p = normalize(phrase).trim();
  // Latin phrases must match on word starts ("fits" not inside "benefits");
  // Telugu phrases match anywhere (suffixes attach to words).
  return /[a-z]/.test(p) ? normalized.includes(` ${p}`) : normalized.includes(p);
}

function hasInfant(context: CareChatContext | undefined): boolean {
  return (context?.children ?? []).some(({ age }) => {
    const match = /^(\d+) weeks?$/.exec(age.trim());
    return match ? Number(match[1]) < 13 : false;
  });
}

export function detectDangerSigns(message: string, context?: CareChatContext): { selfHarm: boolean; urgent: boolean } {
  const text = normalize(message);
  const selfHarm = SELF_HARM_PHRASES.some((phrase) => hasPhrase(text, phrase));
  const danger = DANGER_PHRASES.some((phrase) => hasPhrase(text, phrase));
  const infantFever = hasInfant(context) && FEVER_WORDS.some((word) => hasPhrase(text, word));
  return { selfHarm, urgent: danger || infantFever || selfHarm };
}

const LINES = {
  en: {
    callNow: 'Please call 108 or go to the hospital now.',
    selfHarm: 'Please talk to someone now: call Tele MANAS 14416 (free, any time) or 108.',
    fallback: (hospital: string) => `Sorry, I cannot answer that here. Please ask your doctor at ${hospital}.`,
    yourHospital: 'your hospital',
  },
  te: {
    callNow: 'దయచేసి వెంటనే 108కి కాల్ చేయండి లేదా హాస్పిటల్‌కు వెళ్ళండి.',
    selfHarm: 'దయచేసి ఇప్పుడే ఎవరితోనైనా మాట్లాడండి: Tele MANAS 14416 (ఉచితం, ఎప్పుడైనా) లేదా 108కి కాల్ చేయండి.',
    fallback: (hospital: string) => `క్షమించండి, దీనికి ఇక్కడ సమాధానం ఇవ్వలేను. దయచేసి ${hospital} లో మీ డాక్టర్‌ను అడగండి.`,
    yourHospital: 'మీ హాస్పిటల్',
  },
} as const;

// Guarantees the spec: urgent → first line says call 108 / go now;
// self-harm → Tele MANAS 14416 or 108 is in the reply.
export function enforceSafetyLines(reply: string, flags: { selfHarm: boolean; urgent: boolean }, language: ChatLanguage): string {
  let text = reply.trim();
  if (flags.selfHarm && !text.includes('14416')) text = `${LINES[language].selfHarm}\n${text}`;
  const firstLine = text.split('\n')[0] ?? '';
  if (flags.urgent && !firstLine.includes('108')) text = `${LINES[language].callNow}\n${text}`;
  return text;
}

export function fallbackReply(language: ChatLanguage, hospital: string | null | undefined, flags: { selfHarm: boolean; urgent: boolean }): string {
  return enforceSafetyLines(LINES[language].fallback(hospital || LINES[language].yourHospital), flags, language);
}

export const CARE_CHAT_SYSTEM_PROMPT = `You are DrJiva's after-hospital care helper for patients of partner hospitals in Kadapa, Andhra Pradesh, India. Many users are elderly and only read simple words.

Language and length:
- Reply in the same language and script as the patient's latest message. Telugu script gets Telugu script. Telugu written in English letters (for example "naku jwaram undi") gets the same style back. English gets simple English.
- At most 5 short lines. Very simple words. No headings, tables, lists of more than 3 points, or markdown.

You may help with: general recovery, food and drink, rest, wound care, hygiene, the patient's medicine timings exactly as listed in the context (morning, afternoon, night), getting ready for the next hospital visit, and the dates of the steps in their fertility treatment plan exactly as listed in the context (what a scan, blood test, injection or IUI generally is, in simple words).

Never:
- Diagnose or say what a symptom is or means.
- Tell them to start, stop, skip, double or change any medicine or dose. When asked, say "Please ask your doctor at <hospital>", using the hospital from the context, or "your hospital" if there is none.
- Invent hospital details such as fees, timings, phone numbers or doctor availability.
- Answer questions that are not about the patient's health and care. Politely say you can only help with health and recovery.

Danger signs. If the message mentions any of these, the FIRST line must tell them to call 108 or go to the hospital now, and set urgent to true:
- General: chest pain, breathlessness, fainting, fits, stroke signs (face drooping, weak arm or leg, slurred speech), heavy bleeding, severe stomach pain, vomiting blood or black stools, high fever that does not settle, pus in a wound or a wound opening, face or lip swelling.
- Pregnancy: any bleeding, water leaking, baby moving less, severe headache, blurred vision, sudden swelling.
- Fertility treatment: a very swollen or tight tummy, severe tummy pain, breathlessness, or passing very little urine after the injections.
- Child: fever in a baby under 3 months, not feeding, very sleepy or hard to wake, fast breathing, fits, signs of dehydration (no urine, dry mouth, sunken eyes).
If self-harm or suicide is mentioned, kindly urge them to get help now: call Tele MANAS 14416 or 108. Set urgent to true.
Otherwise set urgent to false.

The patient context in the next message comes from DrJiva. Use it only to make the answer fit this patient (their medicine times, pregnancy week, child's age, treatment day and steps, next visit). Do not repeat it unless they ask, and do not mention that you were given context.`;

export function buildContextNote(context: CareChatContext | undefined): string {
  const c = context ?? {};
  const lines = [
    `Today: ${c.today ?? 'unknown'}`,
    `Hospital: ${c.hospital ?? 'not known'}`,
    `Department: ${c.department ?? 'general'}`,
    `Medicines in DrJiva: ${
      c.medicines && c.medicines.length
        ? c.medicines.map((m) => `${m.name} (${m.times.length ? m.times.join(', ') : 'no times set'})`).join('; ')
        : 'none listed'
    }`,
  ];
  if (typeof c.pregnancyWeek === 'number') lines.push(`Pregnancy: week ${c.pregnancyWeek} of 40`);
  if (c.children && c.children.length) lines.push(`Children on a vaccine schedule: ${c.children.map((child) => child.age).join(', ')} old`);
  if (c.cycle && c.cycle.day1) {
    const who = { couple: 'both of them', husband: 'her husband', wife: 'her' } as const;
    lines.push(`Fertility treatment: ${c.cycle.treatment ?? 'OI-TI / IUI'}. Day 1 (her period started): ${c.cycle.day1}. Today is day ${c.cycle.dayOfCycle ?? '?'}.`);
    const steps = (c.cycle.steps ?? []).map((s) => `${s.date} (day ${s.day}) ${s.step}, for ${who[s.who] ?? 'her'}${s.done ? ', done' : ''}`);
    if (steps.length) lines.push(`Treatment steps: ${steps.slice(0, 14).join('; ')}`);
  }
  lines.push(`Next follow-up visit: ${c.nextFollowupDate ?? 'not set yet'}`);
  if (c.pendingItems && c.pendingItems.length) lines.push(`Checklist items not done yet: ${c.pendingItems.slice(0, 8).join('; ')}`);
  return lines.join('\n');
}
