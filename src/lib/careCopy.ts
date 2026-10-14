import { useMemo } from 'react';

import { useLanguage, type AppLanguage } from './i18n';

// All new My Care text, English + Telugu side by side so a native
// speaker can review it in one place. {name} parts are filled in at
// runtime. Visit and checklist names come from the database (also
// English + Telugu).
const en = {
  title: 'My Care',
  subtitle: 'Your visits and care after the hospital',
  nextVisit: 'Next visit',
  today: 'Today',
  tomorrow: 'Tomorrow',
  inDays: 'In {n} days',
  atThisVisit: 'At this visit',
  nurseNote: 'Note from the nurse',
  updatedBy: 'Updated by nurse {nurse} on {date}',
  callHospital: 'Call hospital',
  noDateYet: 'Your nurse will add your next visit date after your consultation.',
  pregnancy: 'Pregnancy',
  dueDate: 'Expected delivery {date}',
  pregnancyMonth: '{n} month',
  week: 'Week {week}',
  weekShort: 'Week',
  thisWeek: 'This week',
  asBigAs: 'As big as {fruit}',
  weight: 'Weight',
  lengthHeadToBottom: 'Head to bottom',
  lengthHeadToHeel: 'Head to heel',
  underOneGram: 'Under 1 g',
  amountMm: '{n} mm',
  amountCm: '{n} cm',
  amountG: '{n} g',
  amountKg: '{n} kg',
  ageWeek1: '1 week old',
  ageWeeks: '{n} weeks old',
  ageMonth1: '1 month old',
  ageMonths: '{n} months old',
  ageYear1: '1 year old',
  ageYears: '{n} years old',
  ageNewborn: 'Newborn',
  askDrJiva: 'Ask DrJiva',
  chatSubtitle: 'Free AI helper · not a doctor',
  chatWelcome: 'Hi! Ask me about food, rest, your tablet timings or your next visit.',
  suggestFoodWeek: 'What should I eat this week?',
  suggestAvoid: 'Which foods should I avoid?',
  suggestSleep: 'How should I sleep now?',
  suggestNextVisit: 'What happens at my next visit?',
  suggestFood: 'What can I eat?',
  suggestTablets: 'When do I take my tablets?',
  typeQuestion: 'Type your question',
  send: 'Send',
  typing: 'DrJiva is typing…',
  remaining: '{n} questions left today',
  disclaimer: 'General information only, not medical advice. Emergency: call 108.',
  call108: 'Call 108',
  urgentTitle: 'This may need care right now',
  urgentBody: 'Call 108 or go to the hospital now.',
  limitReached: 'You have asked 30 questions today. Please try again tomorrow.',
  chatError: 'Could not send. Check your internet and try again.',
  chatUnavailable: 'Chat is not available right now. Please try later.',
  close: 'Close',
  loading: 'Loading your care…',
  offline: 'Showing your last saved details. Pull down to refresh.',
  loadError: 'Could not load My Care. Pull down to try again.',
  notLinked: 'Open DrJiva with your mobile number to see your care details.',
  reminderEveTitle: 'Hospital visit tomorrow',
  reminderEveBody: 'Your follow-up visit at {hospital} is tomorrow.',
  reminderDayTitle: 'Hospital visit today',
  reminderDayBody: 'Your follow-up visit at {hospital} is today.',
  cycleTab: 'Fertility treatment',
  cycleDay: 'Day {n}',
  dayShort: 'Day',
  cycleOfDays: 'of {n}',
  cycleDayOne: 'Day 1 (period started): {date}',
  cyclePlan: 'Your treatment plan',
  cycleStarts: 'Your treatment starts on {date}',
  cycleNoStep: 'No hospital visit this day',
  cycleNext: 'Next: {step}',
  cycleNextOn: 'Day {n} · {date}',
  cycleNextBadge: 'Next',
  cycleOver: 'All treatment days are over. Your hospital will tell you what comes next.',
  cycleDone: 'Done',
  whoWife: 'You',
  whoHusband: 'Husband',
  whoCouple: 'Both of you',
  suggestCycleNext: 'What happens at my next step?',
  suggestCycleFood: 'What should I eat during treatment?',
  suggestCycleIui: 'How do I get ready for IUI?',
  cycleReminderEveTitle: 'Tomorrow: {steps}',
  cycleReminderDayTitle: 'Today: {steps}',
  cycleReminderBody: 'Day {n} of your treatment at {hospital}.',
} as const;

export type CareCopyKey = keyof typeof en;

const te: Record<CareCopyKey, string> = {
  title: 'నా సంరక్షణ',
  subtitle: 'మీ సందర్శనలు, హాస్పిటల్ తర్వాత సంరక్షణ',
  nextVisit: 'తదుపరి సందర్శన',
  today: 'ఈరోజు',
  tomorrow: 'రేపు',
  inDays: '{n} రోజుల్లో',
  atThisVisit: 'ఈ సందర్శనలో',
  nurseNote: 'నర్సు సూచన',
  updatedBy: 'నర్సు {nurse} {date}న అప్‌డేట్ చేశారు',
  callHospital: 'హాస్పిటల్‌కు కాల్ చేయండి',
  noDateYet: 'డాక్టర్‌ను కలిసిన తర్వాత మీ నర్సు తదుపరి సందర్శన తేదీని ఇక్కడ చేర్చుతారు.',
  pregnancy: 'గర్భధారణ',
  dueDate: 'అంచనా డెలివరీ తేదీ {date}',
  pregnancyMonth: '{n}వ నెల',
  week: '{week}వ వారం',
  weekShort: 'వారం',
  thisWeek: 'ఈ వారం',
  asBigAs: '{fruit} అంత ఉంటుంది',
  weight: 'బరువు',
  lengthHeadToBottom: 'పొడవు',
  lengthHeadToHeel: 'తల నుంచి మడమ వరకు',
  underOneGram: '1 గ్రాము కంటే తక్కువ',
  amountMm: '{n} మి.మీ.',
  amountCm: '{n} సెం.మీ.',
  amountG: '{n} గ్రాములు',
  amountKg: '{n} కిలోలు',
  ageWeek1: '1 వారం వయస్సు',
  ageWeeks: '{n} వారాల వయస్సు',
  ageMonth1: '1 నెల వయస్సు',
  ageMonths: '{n} నెలల వయస్సు',
  ageYear1: '1 సంవత్సరం వయస్సు',
  ageYears: '{n} సంవత్సరాల వయస్సు',
  ageNewborn: 'అప్పుడే పుట్టిన బిడ్డ',
  askDrJiva: 'DrJiva ను అడగండి',
  chatSubtitle: 'ఉచిత AI సహాయకుడు · డాక్టర్ కాదు',
  chatWelcome: 'నమస్తే! ఆహారం, విశ్రాంతి, మీ మాత్రల సమయాలు లేదా మీ తదుపరి సందర్శన గురించి అడగండి.',
  suggestFoodWeek: 'ఈ వారం నేను ఏమి తినాలి?',
  suggestAvoid: 'ఏ ఆహారాలు తినకూడదు?',
  suggestSleep: 'ఇప్పుడు ఎలా పడుకోవాలి?',
  suggestNextVisit: 'నా తదుపరి సందర్శనలో ఏమి చేస్తారు?',
  suggestFood: 'నేను ఏమి తినొచ్చు?',
  suggestTablets: 'నా మాత్రలు ఎప్పుడు వేసుకోవాలి?',
  typeQuestion: 'మీ ప్రశ్న టైప్ చేయండి',
  send: 'పంపు',
  typing: 'DrJiva టైప్ చేస్తోంది…',
  remaining: 'ఈరోజు ఇంకా {n} ప్రశ్నలు అడగవచ్చు',
  disclaimer: 'సాధారణ సమాచారం మాత్రమే, వైద్య సలహా కాదు. అత్యవసరమైతే 108కి కాల్ చేయండి.',
  call108: '108కి కాల్ చేయండి',
  urgentTitle: 'దీనికి వెంటనే వైద్యం అవసరం కావచ్చు',
  urgentBody: 'వెంటనే 108కి కాల్ చేయండి లేదా హాస్పిటల్‌కు వెళ్ళండి.',
  limitReached: 'ఈరోజు 30 ప్రశ్నలు అడిగారు. దయచేసి రేపు మళ్ళీ ప్రయత్నించండి.',
  chatError: 'పంపలేకపోయాం. ఇంటర్నెట్ చూసి మళ్ళీ ప్రయత్నించండి.',
  chatUnavailable: 'చాట్ ఇప్పుడు అందుబాటులో లేదు. కాసేపటి తర్వాత ప్రయత్నించండి.',
  close: 'మూసివేయి',
  loading: 'మీ సంరక్షణ వివరాలు వస్తున్నాయి…',
  offline: 'చివరిగా సేవ్ చేసిన వివరాలు చూపిస్తున్నాం. రిఫ్రెష్ చేయడానికి కిందికి లాగండి.',
  loadError: 'నా సంరక్షణ లోడ్ కాలేదు. మళ్ళీ ప్రయత్నించడానికి కిందికి లాగండి.',
  notLinked: 'మీ సంరక్షణ వివరాలు చూడటానికి మీ మొబైల్ నంబర్‌తో DrJiva తెరవండి.',
  reminderEveTitle: 'రేపు హాస్పిటల్ సందర్శన',
  reminderEveBody: '{hospital} లో మీ ఫాలో-అప్ సందర్శన రేపు ఉంది.',
  reminderDayTitle: 'ఈరోజు హాస్పిటల్ సందర్శన',
  reminderDayBody: '{hospital} లో మీ ఫాలో-అప్ సందర్శన ఈరోజు ఉంది.',
  cycleTab: 'సంతాన చికిత్స',
  cycleDay: '{n}వ రోజు',
  dayShort: 'రోజు',
  cycleOfDays: 'మొత్తం {n}',
  cycleDayOne: '1వ రోజు (నెలసరి మొదలైన రోజు): {date}',
  cyclePlan: 'మీ చికిత్స ప్లాన్',
  cycleStarts: 'మీ చికిత్స {date}న మొదలవుతుంది',
  cycleNoStep: 'ఈ రోజు హాస్పిటల్‌కు రావాల్సిన అవసరం లేదు',
  cycleNext: 'తదుపరి: {step}',
  cycleNextOn: '{n}వ రోజు · {date}',
  cycleNextBadge: 'తదుపరి',
  cycleOver: 'చికిత్స రోజులు పూర్తయ్యాయి. తర్వాత ఏమి చేయాలో మీ హాస్పిటల్ చెబుతుంది.',
  cycleDone: 'పూర్తయింది',
  whoWife: 'మీరు',
  whoHusband: 'మీ భర్త',
  whoCouple: 'మీరిద్దరూ',
  suggestCycleNext: 'నా తదుపరి దశలో ఏమి చేస్తారు?',
  suggestCycleFood: 'చికిత్స సమయంలో ఏమి తినాలి?',
  suggestCycleIui: 'IUI కి ఎలా సిద్ధం కావాలి?',
  cycleReminderEveTitle: 'రేపు: {steps}',
  cycleReminderDayTitle: 'ఈరోజు: {steps}',
  cycleReminderBody: '{hospital} లో మీ చికిత్స {n}వ రోజు.',
};

const COPY: Record<AppLanguage, Record<CareCopyKey, string>> = { en, te };

const MONTHS: Record<AppLanguage, readonly string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  te: ['జనవరి', 'ఫిబ్రవరి', 'మార్చి', 'ఏప్రిల్', 'మే', 'జూన్', 'జూలై', 'ఆగస్టు', 'సెప్టెంబర్', 'అక్టోబర్', 'నవంబర్', 'డిసెంబర్'],
};

const WEEKDAYS: Record<AppLanguage, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  te: ['ఆదివారం', 'సోమవారం', 'మంగళవారం', 'బుధవారం', 'గురువారం', 'శుక్రవారం', 'శనివారం'],
};

export function careText(
  language: AppLanguage,
  key: CareCopyKey,
  values?: Record<string, string | number>,
): string {
  const template = COPY[language][key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

// "3rd month" / "3వ నెల" (month of pregnancy, 1-9).
export function careMonth(language: AppLanguage, month: number): string {
  if (language === 'te') return careText(language, 'pregnancyMonth', { n: month });
  const suffix = month === 1 ? 'st' : month === 2 ? 'nd' : month === 3 ? 'rd' : 'th';
  return careText(language, 'pregnancyMonth', { n: `${month}${suffix}` });
}

export type CareDateStyle = 'dayMonth' | 'dayMonthYear' | 'weekdayDayMonth';

// 'YYYY-MM-DD' → "Tue, 20 Oct" / "మంగళవారం, 20 అక్టోబర్".
export function careDate(language: AppLanguage, iso: string, style: CareDateStyle = 'dayMonthYear'): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const month = MONTHS[language][m - 1] ?? '';
  const weekday = WEEKDAYS[language][new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? '';
  if (style === 'dayMonth') return `${d} ${month}`;
  if (style === 'weekdayDayMonth') return `${weekday}, ${d} ${month}`;
  return `${d} ${month} ${y}`;
}

export function useCareCopy() {
  const { language } = useLanguage();
  return useMemo(
    () => ({
      c: (key: CareCopyKey, values?: Record<string, string | number>) => careText(language, key, values),
      date: (iso: string, style?: CareDateStyle) => careDate(language, iso, style),
      language,
      pick: (english: string, telugu: string) => (language === 'te' && telugu ? telugu : english),
    }),
    [language],
  );
}
