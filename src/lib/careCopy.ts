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
  weekOf40: 'Week {week} of 40',
  dueDate: 'Due date {date}',
  trimester1: '1st trimester',
  trimester2: '2nd trimester',
  trimester3: '3rd trimester',
  week: 'Week {week}',
  weeks: 'Week {from}–{to}',
  stateDone: 'Done',
  stateDueNow: 'Due now',
  statePending: 'Not done yet – ask your doctor',
  stateUpcoming: 'Upcoming',
  stateNotNeeded: 'Not needed',
  stateOptional: 'Only if your doctor advises',
  doneOn: 'Done on {date}',
  byNurse: 'by {nurse}',
  showPast: 'Show {n} finished visits',
  hidePast: 'Hide finished visits',
  showMoreVisits: 'Show full schedule',
  showLessVisits: 'Show less',
  tapVisit: 'Tap a visit to see what is checked.',
  notForMe: "This doesn't apply to me anymore",
  hideTitle: 'Hide this schedule?',
  hideBody: 'It will not show in your app anymore. Your nurse can still see it.',
  hide: 'Hide',
  cancel: 'Cancel',
  close: 'Close',
  ageWeek1: '1 week old',
  ageWeeks: '{n} weeks old',
  ageMonth1: '1 month old',
  ageMonths: '{n} months old',
  ageYear1: '1 year old',
  ageYears: '{n} years old',
  ageNewborn: 'Newborn',
  vaccines: 'Vaccines',
  askNurseChild: "Ask the nurse to add your child's vaccine schedule.",
  loading: 'Loading your care…',
  offline: 'Showing your last saved details. Pull down to refresh.',
  loadError: 'Could not load My Care. Pull down to try again.',
  notLinked: 'Open DrJiva with your mobile number to see your care details.',
  askDrJiva: 'Ask DrJiva',
  askDrJivaHint: 'Questions about food, rest or your tablets',
  chatTitle: 'After-hospital care – ask anything',
  chatLead: 'Simple answers about recovery, food, rest and your tablet timings.',
  suggestFood: 'What can I eat?',
  suggestTablets: 'When do I take my tablets?',
  suggestSideEffect: 'Is this side effect normal?',
  suggestNextVisit: 'When is my next visit?',
  typeQuestion: 'Type your question',
  send: 'Send',
  typing: 'DrJiva is typing…',
  you: 'You',
  remaining: '{n} questions left today',
  disclaimer: 'DrJiva AI gives general information, not medical advice. Emergency: call 108.',
  call108: 'Call 108',
  urgentTitle: 'This may need care right now',
  urgentBody: 'Call 108 or go to the hospital now.',
  limitReached: 'You have asked 30 questions today. Please try again tomorrow.',
  chatError: 'Could not send. Check your internet and try again.',
  chatUnavailable: 'Chat is not available right now. Please try later.',
  reminderEveTitle: 'Hospital visit tomorrow',
  reminderEveBody: 'Your follow-up visit at {hospital} is tomorrow.',
  reminderDayTitle: 'Hospital visit today',
  reminderDayBody: 'Your follow-up visit at {hospital} is today.',
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
  weekOf40: '40 వారాల్లో {week}వ వారం',
  dueDate: 'డెలివరీ తేదీ {date}',
  trimester1: 'మొదటి త్రైమాసికం',
  trimester2: 'రెండవ త్రైమాసికం',
  trimester3: 'మూడవ త్రైమాసికం',
  week: '{week}వ వారం',
  weeks: '{from}–{to} వారాలు',
  stateDone: 'పూర్తయింది',
  stateDueNow: 'ఇప్పుడు చేయాలి',
  statePending: 'ఇంకా చేయలేదు – డాక్టర్‌ను అడగండి',
  stateUpcoming: 'రాబోయేది',
  stateNotNeeded: 'అవసరం లేదు',
  stateOptional: 'డాక్టర్ సూచిస్తే మాత్రమే',
  doneOn: '{date}న పూర్తయింది',
  byNurse: 'నర్సు {nurse}',
  showPast: 'పూర్తయిన {n} సందర్శనలు చూపించు',
  hidePast: 'పూర్తయిన సందర్శనలు దాచు',
  showMoreVisits: 'పూర్తి షెడ్యూల్ చూపించు',
  showLessVisits: 'తక్కువ చూపించు',
  tapVisit: 'ఏమి చేశారో చూడటానికి సందర్శనను నొక్కండి.',
  notForMe: 'ఇది ఇప్పుడు నాకు వర్తించదు',
  hideTitle: 'ఈ షెడ్యూల్ దాచాలా?',
  hideBody: 'ఇది మీ యాప్‌లో ఇక కనిపించదు. మీ నర్సు చూడగలరు.',
  hide: 'దాచు',
  cancel: 'రద్దు',
  close: 'మూసివేయి',
  ageWeek1: '1 వారం వయస్సు',
  ageWeeks: '{n} వారాల వయస్సు',
  ageMonth1: '1 నెల వయస్సు',
  ageMonths: '{n} నెలల వయస్సు',
  ageYear1: '1 సంవత్సరం వయస్సు',
  ageYears: '{n} సంవత్సరాల వయస్సు',
  ageNewborn: 'అప్పుడే పుట్టిన బిడ్డ',
  vaccines: 'టీకాలు',
  askNurseChild: 'మీ బిడ్డ టీకాల షెడ్యూల్‌ను జోడించమని నర్సును అడగండి.',
  loading: 'మీ సంరక్షణ వివరాలు వస్తున్నాయి…',
  offline: 'చివరిగా సేవ్ చేసిన వివరాలు చూపిస్తున్నాం. రిఫ్రెష్ చేయడానికి కిందికి లాగండి.',
  loadError: 'నా సంరక్షణ లోడ్ కాలేదు. మళ్ళీ ప్రయత్నించడానికి కిందికి లాగండి.',
  notLinked: 'మీ సంరక్షణ వివరాలు చూడటానికి మీ మొబైల్ నంబర్‌తో DrJiva తెరవండి.',
  askDrJiva: 'DrJiva ను అడగండి',
  askDrJivaHint: 'ఆహారం, విశ్రాంతి, మీ మందుల గురించి అడగండి',
  chatTitle: 'హాస్పిటల్ తర్వాత సంరక్షణ – ఏదైనా అడగండి',
  chatLead: 'కోలుకోవడం, ఆహారం, విశ్రాంతి, మీ మందుల సమయాల గురించి సులభమైన సమాధానాలు.',
  suggestFood: 'నేను ఏమి తినొచ్చు?',
  suggestTablets: 'నా మాత్రలు ఎప్పుడు వేసుకోవాలి?',
  suggestSideEffect: 'ఈ సైడ్ ఎఫెక్ట్ సాధారణమేనా?',
  suggestNextVisit: 'నా తదుపరి సందర్శన ఎప్పుడు?',
  typeQuestion: 'మీ ప్రశ్న టైప్ చేయండి',
  send: 'పంపు',
  typing: 'DrJiva టైప్ చేస్తోంది…',
  you: 'మీరు',
  remaining: 'ఈరోజు ఇంకా {n} ప్రశ్నలు అడగవచ్చు',
  disclaimer: 'DrJiva AI సాధారణ సమాచారం మాత్రమే ఇస్తుంది, వైద్య సలహా కాదు. అత్యవసరమైతే 108కి కాల్ చేయండి.',
  call108: '108కి కాల్ చేయండి',
  urgentTitle: 'దీనికి వెంటనే వైద్యం అవసరం కావచ్చు',
  urgentBody: 'వెంటనే 108కి కాల్ చేయండి లేదా హాస్పిటల్‌కు వెళ్ళండి.',
  limitReached: 'ఈరోజు 30 ప్రశ్నలు అడిగారు. దయచేసి రేపు మళ్ళీ ప్రయత్నించండి.',
  chatError: 'పంపలేకపోయాం. ఇంటర్నెట్ చూసి మళ్ళీ ప్రయత్నించండి.',
  chatUnavailable: 'చాట్ ఇప్పుడు అందుబాటులో లేదు. కాసేపటి తర్వాత ప్రయత్నించండి.',
  reminderEveTitle: 'రేపు హాస్పిటల్ సందర్శన',
  reminderEveBody: '{hospital} లో మీ ఫాలో-అప్ సందర్శన రేపు ఉంది.',
  reminderDayTitle: 'ఈరోజు హాస్పిటల్ సందర్శన',
  reminderDayBody: '{hospital} లో మీ ఫాలో-అప్ సందర్శన ఈరోజు ఉంది.',
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
