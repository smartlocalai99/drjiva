# My Care – Telugu text to review

Every new piece of Telugu text, next to its English. Where to change it:

- App screen text: `src/lib/careCopy.ts` (the `te` block) – needs an app update.
- Baby size comparisons (week 4–40): `src/lib/babySize.ts` – needs an app update.
- Visit names and checklist items: Supabase tables `care_schedule_visits` / `care_schedule_items` (`title_te`, `label_te`) – changes show at once, no app update.
- Reminder push text: function `care_send_followup_reminders` in the database.

## App screen

| English | Telugu |
|---|---|
| My Care (tab) | నా సంరక్షణ |
| My Care | నా సంరక్షణ |
| Your visits and care after the hospital | మీ సందర్శనలు, హాస్పిటల్ తర్వాత సంరక్షణ |
| Next visit | తదుపరి సందర్శన |
| Today | ఈరోజు |
| Tomorrow | రేపు |
| In {n} days | {n} రోజుల్లో |
| At this visit | ఈ సందర్శనలో |
| Note from the nurse | నర్సు సూచన |
| Updated by nurse {nurse} on {date} | నర్సు {nurse} {date}న అప్‌డేట్ చేశారు |
| Call hospital | హాస్పిటల్‌కు కాల్ చేయండి |
| Your nurse will add your next visit date after your consultation. | డాక్టర్‌ను కలిసిన తర్వాత మీ నర్సు తదుపరి సందర్శన తేదీని ఇక్కడ చేర్చుతారు. |
| Pregnancy | గర్భధారణ |
| Due date {date} | డెలివరీ తేదీ {date} |
| 1st trimester | మొదటి త్రైమాసికం |
| 2nd trimester | రెండవ త్రైమాసికం |
| 3rd trimester | మూడవ త్రైమాసికం |
| Week {week} | {week}వ వారం |
| Week | వారం |
| This week | ఈ వారం |
| As big as {fruit} | {fruit} అంత ఉంటుంది |
| Weight | బరువు |
| Head to bottom | పొడవు |
| Head to heel | తల నుంచి మడమ వరకు |
| Under 1 g | 1 గ్రాము కంటే తక్కువ |
| {n} mm | {n} మి.మీ. |
| {n} cm | {n} సెం.మీ. |
| {n} g | {n} గ్రాములు |
| {n} kg | {n} కిలోలు |
| This doesn't apply to me anymore | ఇది ఇప్పుడు నాకు వర్తించదు |
| Hide this schedule? | ఈ షెడ్యూల్ దాచాలా? |
| It will not show in your app anymore. Your nurse can still see it. | ఇది మీ యాప్‌లో ఇక కనిపించదు. మీ నర్సు చూడగలరు. |
| Hide | దాచు |
| Cancel | రద్దు |
| 1 week old | 1 వారం వయస్సు |
| {n} weeks old | {n} వారాల వయస్సు |
| 1 month old | 1 నెల వయస్సు |
| {n} months old | {n} నెలల వయస్సు |
| 1 year old | 1 సంవత్సరం వయస్సు |
| {n} years old | {n} సంవత్సరాల వయస్సు |
| Newborn | అప్పుడే పుట్టిన బిడ్డ |
| Loading your care… | మీ సంరక్షణ వివరాలు వస్తున్నాయి… |
| Showing your last saved details. Pull down to refresh. | చివరిగా సేవ్ చేసిన వివరాలు చూపిస్తున్నాం. రిఫ్రెష్ చేయడానికి కిందికి లాగండి. |
| Could not load My Care. Pull down to try again. | నా సంరక్షణ లోడ్ కాలేదు. మళ్ళీ ప్రయత్నించడానికి కిందికి లాగండి. |
| Open DrJiva with your mobile number to see your care details. | మీ సంరక్షణ వివరాలు చూడటానికి మీ మొబైల్ నంబర్‌తో DrJiva తెరవండి. |
| Hospital visit tomorrow | రేపు హాస్పిటల్ సందర్శన |
| Your follow-up visit at {hospital} is tomorrow. | {hospital} లో మీ ఫాలో-అప్ సందర్శన రేపు ఉంది. |
| Hospital visit today | ఈరోజు హాస్పిటల్ సందర్శన |
| Your follow-up visit at {hospital} is today. | {hospital} లో మీ ఫాలో-అప్ సందర్శన ఈరోజు ఉంది. |

## Baby size ("As big as …")

| Week | English | Telugu |
|---|---|---|
| 4 | a poppy seed | గసగసాల గింజ |
| 5 | a sesame seed | నువ్వు గింజ |
| 6 | a grain of rice | బియ్యం గింజ |
| 7 | a peanut | వేరుశనగ గింజ |
| 8 | a grape | ద్రాక్ష పండు |
| 9 | a jamun | నేరేడు పండు |
| 10 | an amla | ఉసిరికాయ |
| 11 | a fig | అంజీర పండు |
| 12 | a lemon | నిమ్మకాయ |
| 13 | a sapota | సపోటా పండు |
| 14 | a guava | జామకాయ |
| 15 | an apple | ఆపిల్ పండు |
| 16 | a pomegranate | దానిమ్మ పండు |
| 17 | a sweet potato | చిలగడదుంప |
| 18 | a capsicum | క్యాప్సికం |
| 19 | a mango | మామిడి పండు |
| 20 | a banana | అరటి పండు |
| 21 | a carrot | క్యారెట్ |
| 22 | a ridge gourd | బీరకాయ |
| 23 | a papaya | బొప్పాయి పండు |
| 24 | a corn cob | మొక్కజొన్న కంకి |
| 25 | a radish | ముల్లంగి |
| 26 | a cauliflower | కాలీఫ్లవర్ |
| 27 | a yellow cucumber | దోసకాయ |
| 28 | a large brinjal | పెద్ద వంకాయ |
| 29 | a cabbage | క్యాబేజీ |
| 30 | a bottle gourd | సొరకాయ |
| 31 | a coconut | కొబ్బరికాయ |
| 32 | a pineapple | అనాస పండు |
| 33 | a muskmelon | కర్బూజ పండు |
| 34 | a large papaya | పెద్ద బొప్పాయి పండు |
| 35 | a small jackfruit | చిన్న పనస పండు |
| 36 | an ash gourd | బూడిద గుమ్మడికాయ |
| 37 | a pumpkin | గుమ్మడికాయ |
| 38 | a large pumpkin | పెద్ద గుమ్మడికాయ |
| 39 | a small watermelon | చిన్న పుచ్చకాయ |
| 40 | a watermelon | పుచ్చకాయ |

## Schedule headings and every-visit lines

| English | Telugu |
|---|---|
| Pregnancy | గర్భధారణ |
| Every visit: BP, weight, urine albumin & sugar | ప్రతి సందర్శనలో: BP, బరువు, మూత్రంలో ఆల్బుమిన్ & షుగర్ |
| Child vaccines | పిల్లల టీకాలు |
| Every visit till 2 years: weight, height, head size | 2 ఏళ్ల వరకు ప్రతి సందర్శనలో: బరువు, ఎత్తు, తల చుట్టుకొలత |

## Visit names

| Schedule | English | Telugu |
|---|---|---|
| pregnancy | First visit | మొదటి సందర్శన |
| pregnancy | NT scan visit | NT స్కాన్ సందర్శన |
| pregnancy | Week 16 visit | 16వ వారం సందర్శన |
| pregnancy | Anomaly scan visit | అనామలీ స్కాన్ సందర్శన |
| pregnancy | Sugar test visit | షుగర్ పరీక్ష సందర్శన |
| pregnancy | Week 28 visit | 28వ వారం సందర్శన |
| pregnancy | Week 30 visit | 30వ వారం సందర్శన |
| pregnancy | Growth scan visit | గ్రోత్ స్కాన్ సందర్శన |
| pregnancy | Week 34 visit | 34వ వారం సందర్శన |
| pregnancy | Week 36 visit | 36వ వారం సందర్శన |
| pregnancy | Week 37 check | 37వ వారం చెకప్ |
| pregnancy | Week 38 check | 38వ వారం చెకప్ |
| pregnancy | Week 39 check | 39వ వారం చెకప్ |
| pregnancy | Due-date review | డెలివరీ తేదీ సమీక్ష |
| child | At birth | పుట్టినప్పుడు |
| child | 6 weeks | 6 వారాలు |
| child | 10 weeks | 10 వారాలు |
| child | 14 weeks | 14 వారాలు |
| child | 6 months | 6 నెలలు |
| child | 7 months | 7 నెలలు |
| child | 9 months | 9 నెలలు |
| child | 12 months | 12 నెలలు |
| child | Yearly flu shot – age 1 | ఏటా ఫ్లూ టీకా – 1 ఏడాది |
| child | 15 months | 15 నెలలు |
| child | 16–18 months | 16–18 నెలలు |
| child | 18–19 months | 18–19 నెలలు |
| child | Yearly flu shot – age 2 | ఏటా ఫ్లూ టీకా – 2 ఏళ్లు |
| child | Yearly flu shot – age 3 | ఏటా ఫ్లూ టీకా – 3 ఏళ్లు |
| child | 4–6 years | 4–6 ఏళ్లు |
| child | Yearly flu shot – age 4 | ఏటా ఫ్లూ టీకా – 4 ఏళ్లు |
| child | Yearly flu shot – age 5 | ఏటా ఫ్లూ టీకా – 5 ఏళ్లు |
| child | 9–14 years | 9–14 ఏళ్లు |
| child | 10–12 years | 10–12 ఏళ్లు |
| child | 16–18 years | 16–18 ఏళ్లు |

## Checklist items

| Visit | English | Telugu |
|---|---|---|
| First visit | Dating / viability scan | మొదటి స్కాన్ (గర్భం వయస్సు, గుండె చప్పుడు) |
| First visit | Blood tests: Hb/CBC, blood group & Rh, sugar, thyroid (TSH), HIV, Hepatitis B, VDRL | రక్త పరీక్షలు: Hb/CBC, బ్లడ్ గ్రూప్ & Rh, షుగర్, థైరాయిడ్ (TSH), HIV, హెపటైటిస్ B, VDRL |
| First visit | Urine routine test | మూత్ర పరీక్ష (రొటీన్) |
| First visit | Folic acid tablets started | ఫోలిక్ యాసిడ్ మాత్రలు మొదలు |
| NT scan visit | NT scan | NT స్కాన్ |
| NT scan visit | Double marker test (if advised) | డబుల్ మార్కర్ పరీక్ష (డాక్టర్ సూచిస్తే) |
| Week 16 visit | Reports reviewed by doctor | రిపోర్టులు డాక్టర్ చూశారు |
| Week 16 visit | Iron + calcium tablets started | ఐరన్ + కాల్షియం మాత్రలు మొదలు |
| Week 16 visit | Td/TT injection – dose 1 | Td/TT ఇంజెక్షన్ – 1వ డోసు |
| Anomaly scan visit | Anomaly scan (TIFFA / Level-2) | అనామలీ స్కాన్ (TIFFA / లెవల్-2) |
| Anomaly scan visit | Td/TT injection – dose 2 (4–6 weeks after dose 1) | Td/TT ఇంజెక్షన్ – 2వ డోసు (1వ డోసు తర్వాత 4–6 వారాలకు) |
| Sugar test visit | Sugar test (GTT) | షుగర్ పరీక్ష (GTT) |
| Week 28 visit | Hb/CBC repeat | Hb/CBC మళ్ళీ పరీక్ష |
| Week 28 visit | Anti-D injection (only if Rh negative) | Anti-D ఇంజెక్షన్ (Rh నెగటివ్ అయితే మాత్రమే) |
| Week 28 visit | Tdap (27–36 weeks, if advised) | Tdap (27–36 వారాల మధ్య, డాక్టర్ సూచిస్తే) |
| Week 30 visit | Routine check | రొటీన్ చెకప్ |
| Growth scan visit | Growth scan | గ్రోత్ స్కాన్ (బిడ్డ ఎదుగుదల) |
| Growth scan visit | Doppler scan (if advised) | డాప్లర్ స్కాన్ (డాక్టర్ సూచిస్తే) |
| Week 34 visit | Routine check | రొటీన్ చెకప్ |
| Week 34 visit | Baby-movement counting explained | బిడ్డ కదలికలు లెక్కించడం నేర్పించారు |
| Week 36 visit | Hb + urine repeat | Hb + మూత్ర పరీక్ష మళ్ళీ |
| Week 36 visit | Baby position check | బిడ్డ స్థానం (పొజిషన్) పరీక్ష |
| Week 36 visit | Delivery plan + hospital bag ready | డెలివరీ ప్లాన్ + హాస్పిటల్ బ్యాగ్ సిద్ధం |
| Week 37 check | Weekly check | వారపు చెకప్ |
| Week 37 check | NST (if advised) | NST (డాక్టర్ సూచిస్తే) |
| Week 38 check | Weekly check | వారపు చెకప్ |
| Week 38 check | NST (if advised) | NST (డాక్టర్ సూచిస్తే) |
| Week 39 check | Weekly check | వారపు చెకప్ |
| Week 39 check | NST (if advised) | NST (డాక్టర్ సూచిస్తే) |
| Due-date review | Due-date review | డెలివరీ తేదీ సమీక్ష |
| Due-date review | NST (if advised) | NST (డాక్టర్ సూచిస్తే) |
| At birth | BCG | BCG టీకా |
| At birth | OPV-0 (polio drops) | OPV-0 (పోలియో చుక్కలు) |
| At birth | Hepatitis B – 1 | హెపటైటిస్ B – 1 |
| 6 weeks | DTwP/DTaP – 1 | DTwP/DTaP – 1 |
| 6 weeks | IPV – 1 | IPV – 1 |
| 6 weeks | Hib – 1 | Hib – 1 |
| 6 weeks | Hepatitis B – 2 | హెపటైటిస్ B – 2 |
| 6 weeks | Rotavirus – 1 | రోటావైరస్ – 1 |
| 6 weeks | PCV – 1 | PCV – 1 |
| 10 weeks | DTwP/DTaP – 2 | DTwP/DTaP – 2 |
| 10 weeks | IPV – 2 | IPV – 2 |
| 10 weeks | Hib – 2 | Hib – 2 |
| 10 weeks | Hepatitis B – 3 | హెపటైటిస్ B – 3 |
| 10 weeks | Rotavirus – 2 | రోటావైరస్ – 2 |
| 10 weeks | PCV – 2 | PCV – 2 |
| 14 weeks | DTwP/DTaP – 3 | DTwP/DTaP – 3 |
| 14 weeks | IPV – 3 | IPV – 3 |
| 14 weeks | Hib – 3 | Hib – 3 |
| 14 weeks | Hepatitis B – 4 | హెపటైటిస్ B – 4 |
| 14 weeks | Rotavirus – 3 (not needed for 2-dose brand) | రోటావైరస్ – 3 (2-డోసు బ్రాండ్ అయితే అవసరం లేదు) |
| 14 weeks | PCV – 3 | PCV – 3 |
| 6 months | Influenza (flu) – 1 | ఇన్ఫ్లుఎంజా (ఫ్లూ) – 1 |
| 6 months | Typhoid conjugate (TCV, 6–9 months) | టైఫాయిడ్ కాంజుగేట్ టీకా (TCV, 6–9 నెలలు) |
| 7 months | Influenza (flu) – 2 | ఇన్ఫ్లుఎంజా (ఫ్లూ) – 2 |
| 9 months | MMR – 1 | MMR – 1 |
| 12 months | Hepatitis A – 1 | హెపటైటిస్ A – 1 |
| Yearly flu shot – age 1 | Influenza – yearly (before monsoon) | ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు) |
| 15 months | MMR – 2 | MMR – 2 |
| 15 months | Varicella (chickenpox) – 1 | వారిసెల్లా (చికెన్‌పాక్స్) – 1 |
| 15 months | PCV booster | PCV బూస్టర్ |
| 16–18 months | DTwP/DTaP booster – 1 | DTwP/DTaP బూస్టర్ – 1 |
| 16–18 months | Hib booster | Hib బూస్టర్ |
| 16–18 months | IPV booster – 1 | IPV బూస్టర్ – 1 |
| 18–19 months | Hepatitis A – 2 (only for 2-dose brand) | హెపటైటిస్ A – 2 (2-డోసు బ్రాండ్ అయితే మాత్రమే) |
| 18–19 months | Varicella (chickenpox) – 2 | వారిసెల్లా (చికెన్‌పాక్స్) – 2 |
| Yearly flu shot – age 2 | Influenza – yearly (before monsoon) | ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు) |
| Yearly flu shot – age 3 | Influenza – yearly (before monsoon) | ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు) |
| 4–6 years | DTwP/DTaP booster – 2 | DTwP/DTaP బూస్టర్ – 2 |
| 4–6 years | IPV booster – 2 | IPV బూస్టర్ – 2 |
| 4–6 years | MMR – 3 | MMR – 3 |
| Yearly flu shot – age 4 | Influenza – yearly (before monsoon) | ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు) |
| Yearly flu shot – age 5 | Influenza – yearly (before monsoon) | ఇన్ఫ్లుఎంజా – ఏటా (వర్షాకాలానికి ముందు) |
| 9–14 years | HPV – dose 1 | HPV – 1వ డోసు |
| 9–14 years | HPV – dose 2 (boys only, 6 months after dose 1) | HPV – 2వ డోసు (అబ్బాయిలకు మాత్రమే, 1వ డోసు తర్వాత 6 నెలలకు) |
| 10–12 years | Tdap | Tdap |
| 16–18 years | Td | Td |

## Follow-up reminder push (database, 6 PM / 8 AM)

| English | Telugu |
|---|---|
| Hospital visit tomorrow | రేపు హాస్పిటల్ సందర్శన |
| Hospital visit today | ఈరోజు హాస్పిటల్ సందర్శన |
| Your follow-up visit at {hospital} is tomorrow, {date}. | {hospital} లో మీ ఫాలో-అప్ సందర్శన రేపు ఉంది. |
| Your follow-up visit at {hospital} is today. | {hospital} లో మీ ఫాలో-అప్ సందర్శన ఈరోజు ఉంది. |
