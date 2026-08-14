-- Import the concise medicine descriptions supplied for the complete Asian
-- Hospitals image-backed catalogue. The validation blocks keep this migration
-- atomic if catalogue names drift or cease to match one-to-one.
alter table public.medicines
  add column if not exists description text;

comment on column public.medicines.description is
  'Concise catalogue description imported from medicine_name_desc.csv.';

create temporary table asian_medicine_description_import (
  name text primary key,
  description text not null check (btrim(description) <> '')
) on commit drop;

insert into asian_medicine_description_import (name, description)
values
  ('AB FLO CAP', 'Asthma & bronchitis'),
  ('AB FLOW', 'Asthma & bronchitis'),
  ('ACAMPROL 333MG CAP', 'Alcohol dependence'),
  ('ACILOWIR 400 MG', 'Antiviral (herpes)'),
  ('ACITROM 1 MG', 'Blood thinner'),
  ('ACITROM 2 MG', 'Blood thinner'),
  ('ACOGUT 300ER TAB', 'Digestive (dyspepsia)'),
  ('ACOSHIELD 5990', 'Digestive / functional dyspepsia'),
  ('ACOTIBIEN 300ER', 'Digestive / functional dyspepsia'),
  ('ACOXIB MR TAB', 'Pain & inflammation'),
  ('ACTIBILE 300', 'Liver / gallstones'),
  ('AKURIT 3MG TAB', 'TB treatment'),
  ('AKURIT 4MG TAB', 'TB treatment'),
  ('ALADRINE 5MG TAB', 'Low blood pressure'),
  ('ALDACTONE 50MG', 'Blood pressure / diuretic'),
  ('ALLEGRA 120 MG TAB', 'Allergy'),
  ('ALRGEE 180', 'Allergy'),
  ('ALTONIL SR 10', 'Sleep aid'),
  ('ALZIL MSMG TAB', 'Dementia / Alzheimer''s'),
  ('AMBRODIL S SYP', 'Cough'),
  ('AMLOKIND AT TAB', 'Blood pressure'),
  ('APIXAPIL 5MG', 'Blood thinner'),
  ('ARISTOZYME LIQUID', 'Vitamin / tonic'),
  ('ASCORIL D SYP', 'Cough & cold'),
  ('ASCORIL LS SYP', 'Cough / bronchodilator'),
  ('ASCORIL TAB', 'Cough & cold'),
  ('ATARAX 10MG TAB', 'Allergy / anxiety'),
  ('ATARAX 25MG TAB', 'Allergy / anxiety'),
  ('ATARAX ANTI ITCHY LOTION', 'Skin itching / allergy'),
  ('ATORNIZ C', 'Cholesterol'),
  ('ATORVA 80 TAB', 'Cholesterol'),
  ('ATR CLA GOLD 20MG CAPS', 'Cardiovascular prevention / clot prevention'),
  ('AUGMENTIN DUO SYP', 'Antibiotic'),
  ('AVIL 25MG TAB', 'Allergy'),
  ('AZORAN 50MG', 'Immunosuppressant'),
  ('B LONG F TAB', 'Vitamin supplement'),
  ('BACLOF 10 MG TAB', 'Muscle relaxant'),
  ('BANDY PLUS', 'Deworming / antiparasitic'),
  ('BANDY TABS', 'Deworming / antiparasitic'),
  ('BENADON', 'Vitamin B6'),
  ('BENDIWORM IV6', 'Deworming'),
  ('BENIZEP CAPSULE', 'IBS / abdominal cramps'),
  ('BEPLEX', 'Vitamin B complex'),
  ('BEVON SYRUP', 'Vitamin supplement'),
  ('BILACIP M TABS', 'Allergy / asthma'),
  ('BILAZAP M TAB', 'Allergy / asthma'),
  ('BIOMYCETIN DROPS', 'Eye / ear infection'),
  ('BISOACE 2.5 TAB', 'Blood pressure / heart'),
  ('BISTAS 120TAB', 'Peptic ulcer'),
  ('BIXIMOT TAB', 'Constipation'),
  ('BRUTAFLAM 90MG', 'Pain & inflammation'),
  ('BUDEZ CR 3MG', 'Bowel disease (colitis)'),
  ('BUDEZ OD 9MG 15S', 'Bowel disease (colitis)'),
  ('BUSCOGAST TAB', 'Stomach cramps'),
  ('CALLY CURE LOTION', 'Skin care / soothing lotion'),
  ('CALPOL 650 MG', 'Fever & pain'),
  ('CANDID POWDER 50GM', 'Fungal infection'),
  ('CANDID V6 TABLET', 'Fungal infection'),
  ('CARTIMARK FORTE TAB', 'Joint health'),
  ('CARVISTAR 3.125 1374', 'Blood pressure / heart'),
  ('CEFOLAC 200MG', 'Antibiotic'),
  ('CHYMORAL AP TAB', 'Swelling / inflammation'),
  ('CHYMORAL FORTE TAB 2721', 'Swelling / inflammation'),
  ('CILACAR 10MG TAB 4596', 'Blood pressure'),
  ('CILOSOOTH 100 MG', 'Circulation'),
  ('CINOD T', 'Blood pressure'),
  ('CIPLOX TZ TAB', 'Antibiotic'),
  ('CLIDATOP 300', 'Acne'),
  ('CLINGEN FORTE 7S', 'Vaginal infection / discharge'),
  ('CLOPIDOGREL 75 MG', 'Blood thinner'),
  ('COMBUTOL 800MG TAB', 'TB treatment'),
  ('CONSTICHECK SACHETS', 'Constipation'),
  ('COR 3', 'Vitamin B / nerve health'),
  ('COR NVP', 'Pregnancy nausea / vomiting'),
  ('CYCLOSET SYRUP', 'Women''s menstrual health'),
  ('D3 CAP', 'Vitamin D'),
  ('DAFLON 1000 MG TAB 3337', 'Piles / varicose veins'),
  ('DANFREE', 'Antifungal / dandruff'),
  ('DAPAFORD 10MG TAB', 'Diabetes'),
  ('DAPATAC 10MG', 'Diabetes'),
  ('DAPATAC M 10/S00SR TAB', 'Diabetes'),
  ('DDR D TAB', 'Acidity / GERD'),
  ('DECEE Z TAB', 'Immunity (vitamin C & zinc)'),
  ('DEFCORT 12MG', 'Steroid'),
  ('DEFCORT 18MG', 'Steroid'),
  ('DEFCORT 6MG', 'Steroid'),
  ('DERMADEW SOAP', 'Skin care'),
  ('DICLOFAM MR TAB', 'Pain & inflammation'),
  ('DIENOMEG TAB', 'Hormonal (endometriosis)'),
  ('DILZEM SR 90 TAB', 'Blood pressure / heart'),
  ('DIVAA OD', 'Seizure / bipolar / migraine prevention'),
  ('DOLO 500', 'Fever & pain'),
  ('DOLO 650MG TAB', 'Fever & pain'),
  ('DOMSTAL', 'Nausea / vomiting'),
  ('DONAMEM 10MG TAB', 'Dementia / Alzheimer''s'),
  ('DOXY 1 LCR FORTE CA', 'Antibiotic'),
  ('DULCOFLEX 5MG TAB 2649', 'Constipation'),
  ('DUVANTA 30 MG', 'Depression'),
  ('DYTOR PLUS 10MG TAB', 'Diuretic / heart'),
  ('ECOSPRIN 150MG TAB', 'Blood thinner'),
  ('ECOSPRIN 325 TAB', 'Blood thinner'),
  ('ECOSPRIN 75MG', 'Blood thinner'),
  ('ECOSPRIN AV 75 20 MG', 'Blood thinner / cholesterol'),
  ('EIREF 2743 &', 'Acidity / GERD'),
  ('ELCEMET 1000 SR TAB', 'Diabetes'),
  ('ELDERS FLUTICASONE AZ', 'Nasal allergy'),
  ('ELDOPER 2MG CAPSULE', 'Diarrhea'),
  ('ELOBETRA 5MG', 'Constipation'),
  ('EMPAJOY', 'Diabetes'),
  ('EPICETAM INJ', 'Neurological'),
  ('ESOGRESS D CAPSULES', 'Acidity / GERD'),
  ('ESOGRESS IT', 'Acidity / GERD'),
  ('ESOMAC D', 'Acidity / GERD'),
  ('ESOMAC HP', 'Acidity / H.pylori'),
  ('ESOMAC L 13962', 'Acidity / GERD'),
  ('ETELIVA MR 4 TAB', 'Manual verification required'),
  ('ETHAMCIP 250 TAB', 'Bleeding control'),
  ('ETHAMSTAT 250', 'Bleeding control'),
  ('EVITAS MAX CAP', 'Vitamin E'),
  ('EZEDOC 10 MG', 'Cholesterol'),
  ('FEBUTAZ 40MG TAB', 'Gout / uric acid'),
  ('FEXIM O 200MG DT TAB', 'Antibiotic'),
  ('FEXUCLE', 'Allergy'),
  ('FLAGYL 400MG', 'Antibiotic'),
  ('FLAVO MEG', 'Urinary bladder spasm'),
  ('FLEXON SYRUP', 'Pain & fever'),
  ('FLEXON TAB', 'Pain relief'),
  ('FLEXURA D', 'Muscle pain / spasm'),
  ('FLORICOT', 'Adrenal insufficiency / steroid replacement'),
  ('FLULINE 10MG TAB', 'Migraine prevention'),
  ('FLUMONT LC SYRUP', 'Allergy / asthma'),
  ('FOLVITE SMG TAB', 'Anemia / folic acid'),
  ('G SAM 400MG TAB 2434', 'Liver support'),
  ('GABADON 100 TAB', 'Nerve pain'),
  ('GABAKUF 300', 'Nerve pain'),
  ('GABAPIN 300CAP', 'Nerve pain / seizure'),
  ('GABAPIN NT TAB', 'Nerve pain'),
  ('GALVAMARK MET50', 'Diabetes'),
  ('GALVITOL E CAP', 'Liver / fatty liver support'),
  ('GAVISCAN SYP', 'Acidity / reflux'),
  ('GIFTOFER', 'Anemia / iron'),
  ('GLENPINE 10 MG', 'Psychiatric'),
  ('GLENPINE 5 MG', 'Psychiatric'),
  ('GLENTONA XT', 'Anemia / iron'),
  ('GLIMETAS SR', 'Diabetes'),
  ('GLIMY M TAB', 'Diabetes'),
  ('GLIVIPRIDE M1 1305', 'Diabetes'),
  ('GLIVIPRIDE M2', 'Diabetes'),
  ('GLIVIPRIDE MV1', 'Diabetes'),
  ('GLIVIPRIDE MV2', 'Diabetes'),
  ('GLUTAWRIX 500 TAB', 'Antioxidant / liver support'),
  ('GLYCOMET 500MG TABLET', 'Diabetes'),
  ('HALD SR 200', 'Progesterone / fertility support'),
  ('HALD200MG', 'Progesterone / fertility support'),
  ('HCQS 200MG TABLET', 'Autoimmune (rheumatoid arthritis)'),
  ('HERPIFNE 800MG', 'Antiviral (herpes)'),
  ('HIFENAC MR TAB', 'Pain & inflammation'),
  ('HIFENAC P', 'Pain relief'),
  ('INCONTROL 500MG', 'Diabetes'),
  ('INDERAL 20MG', 'Blood pressure / migraine'),
  ('INDERAL 40 MG', 'Blood pressure / migraine'),
  ('INDERAL LA 40MG TAB', 'Blood pressure'),
  ('INSTACLEAN INTIWASH', 'Intimate hygiene'),
  ('ISODER 10 MG', 'Angina / heart'),
  ('ISTAMET 50/500', 'Diabetes'),
  ('ISTAVEL 100 MG TAB', 'Diabetes'),
  ('IVABRAD 5MG TAB', 'Heart (angina)'),
  ('JUNIOR LANZOL 15 MG TAB', 'Acidity / GERD (pediatric)'),
  ('JUNIOR LANZOL 30MG TAB 1332', 'Acidity / GERD (pediatric)'),
  ('KBIND POWDER', 'Kidney (high potassium)'),
  ('KEMLACTIN 4MG TAB', 'Allergy / appetite stimulant'),
  ('KETONAM CREAM', 'Fungal skin infection'),
  ('KEYLYTE SYP', 'Electrolyte supplement'),
  ('KLUVAGUT CAPSULES', 'Antibiotic'),
  ('KRIMSON 35', 'Hormonal (acne / PCOS)'),
  ('LABLOL 100', 'Blood pressure'),
  ('LACOSET 100', 'Seizure / epilepsy'),
  ('LACTARE CAPS', 'Lactation support'),
  ('LACTIFIBER', 'Constipation / fiber'),
  ('LACTIHEP PLUS SYRUP 250ML', 'Liver / constipation'),
  ('LACTIHEP SYRUP', 'Liver / constipation'),
  ('LAREPASM', 'IBS / abdominal cramps'),
  ('LARIAGO', 'Malaria'),
  ('LASILACTONE 50MG', 'Diuretic / heart'),
  ('LASIX 40MG TAB', 'Diuretic / blood pressure'),
  ('LEMONTRA TAB', 'Allergy / asthma'),
  ('LETPRO 2.5 MG TAB', 'Fertility / hormonal'),
  ('LEVECIP 500', 'Seizure / epilepsy'),
  ('LEVIPIL TAB 500', 'Seizure / epilepsy'),
  ('LEVOCAD', 'Allergy'),
  ('LEVOFLOX 500', 'Antibiotic'),
  ('LEVOMAC 500MG TAB', 'Antibiotic'),
  ('LEVORAC 500', 'Antibiotic'),
  ('LEVOSIZ 5 MGTAB', 'Allergy'),
  ('LIBRIUM 10MG TAB', 'Anxiety'),
  ('LIBRIUM 25MG TAB', 'Anxiety'),
  ('LIMCEE', 'Vitamin C'),
  ('LINEZBACT 600', 'Antibiotic'),
  ('LIPAGLYN 4MG 4218', 'Diabetes / fatty liver'),
  ('LIPICARD 160MG TABLET 1015', 'Cholesterol'),
  ('LIPOSUN', 'Cholesterol'),
  ('LITHOSUM 300 MG', 'Psychiatric (bipolar)'),
  ('LIVOGEN Z TAB 2618', 'Anemia / iron'),
  ('LIVOLUK RF FIBRE', 'Constipation'),
  ('LIVOSIZ TAB', 'Allergy'),
  ('LMWX 60 MG INJ', 'Blood thinner'),
  ('LN CATCH 10', 'Blood pressure'),
  ('LONAZEP 0.25MG TAB', 'Anxiety / seizure'),
  ('LUPIVON 20', 'Acidity / GERD / ulcer'),
  ('LYMPEDIM 200MG TAB', 'Lymphedema / swelling'),
  ('MAAPAN 40 MG', 'Acidity'),
  ('MACPEE', 'Urinary retention'),
  ('MAHAGESIC TH4 PLUS', 'Pain relief'),
  ('MEAXON PLUS TAB', 'Nerve health (B12)'),
  ('MEBAWIN C', 'IBS / abdominal cramps'),
  ('MEFENAC SPAS TAB', 'Pain / cramps'),
  ('MEGA HEAL OINT', 'Wound care'),
  ('MEGATAS SSOMG', 'Overactive bladder'),
  ('MEGTHRO 500MG', 'Antibiotic'),
  ('MENOHELP SYRUP', 'Menopause support'),
  ('MEROSURE 0 ER 300 TAB', 'Antibiotic'),
  ('MEROSURE 200 MG', 'Antibiotic'),
  ('MESACOL OD TABLET', 'Bowel disease (colitis)'),
  ('MESACOL SACHETS 1059', 'Bowel disease (colitis)'),
  ('MESAHENZ 1200MG 1513', 'Bowel disease (colitis)'),
  ('METODER XL 25 MG', 'Blood pressure / heart'),
  ('METODER XL 50 MG', 'Blood pressure / heart'),
  ('METROGYL ER 600', 'Antibiotic'),
  ('METROGYL SYRUP', 'Antibiotic'),
  ('METXL 25 MG TAB', 'Blood pressure / heart'),
  ('METXL 50 MG TAB', 'Blood pressure / heart'),
  ('MIDODRIVE 2.5', 'Low blood pressure'),
  ('MIGRANEX 10MG', 'Migraine prevention'),
  ('MIGRANEX 5 MG 1179', 'Migraine prevention'),
  ('MIRASTAG 25MG ER', 'Overactive bladder'),
  ('MIRASTAG 50MG ER TAB', 'Overactive bladder'),
  ('MIRTAZ 7.5 TAB', 'Depression'),
  ('MONTERAL LC SYRUP', 'Allergy / asthma'),
  ('MOXIKIND CV 625 1142', 'Antibiotic'),
  ('MUCEDER T', 'Kidney support / CKD'),
  ('MYCOLON C TAB', 'IBS / abdominal cramps'),
  ('MYOSPAS TAB 12023', 'Muscle cramps'),
  ('NALTIMA 50 TAB', 'Alcohol / opioid dependence'),
  ('NAPFLY D FORTE', 'Migraine / nausea'),
  ('NATFLU 75 MG CAP', 'Antiviral (flu)'),
  ('NEFROSAVE TABLET', 'Kidney health'),
  ('NEFROSOOTH AT 150 500', 'Kidney support / CKD'),
  ('NEO MERCAZOLE 10MG TAB', 'Thyroid (hyperthyroid)'),
  ('NEXITO 10', 'Depression / anxiety'),
  ('NEXITO 20', 'Depression / anxiety'),
  ('NEXITO PLUS', 'Depression / anxiety'),
  ('NEXPRO FAST 40', 'Acidity / GERD'),
  ('NEXPRO RD 40 CAPS', 'Acidity / GERD'),
  ('NICODUCE 5MG', 'Angina / heart'),
  ('NICOTEX', 'Smoking cessation'),
  ('NINDANIB 150', 'Pulmonary fibrosis'),
  ('NINTIB 150 MG', 'Pulmonary fibrosis'),
  ('NODOSIS TAB', 'Kidney (acidosis)'),
  ('NUROKIND SYP', 'Nerve health (B12)'),
  ('ODIUM PRO CAP', 'Women''s health / evening primrose oil'),
  ('OFLOX EYE DROPS', 'Eye infection'),
  ('OMEZ DSR', 'Acidity / GERD'),
  ('OMEZ IT PLUS', 'Acidity / GERD'),
  ('OMNACORTIL 10MG', 'Steroid'),
  ('OMNACORTIL 20MG', 'Steroid'),
  ('OMNACORTIL 40MG', 'Steroid'),
  ('OMNACORTIL 5MG', 'Steroid'),
  ('ORACHYME FORTE TAB', 'Pain / swelling'),
  ('OROGARD MOUTHWASH', 'Oral hygiene'),
  ('OTRIVIN ADULT DROPS', 'Nasal congestion'),
  ('OTRIVIN PAEDIATRIC DROPS', 'Nasal congestion'),
  ('OVABLESS TAB', 'Fertility support'),
  ('OXERUTE CREEM', 'Varicose veins'),
  ('PANACEAS DOXYCYCLINE LB', 'Antibiotic'),
  ('PANKREOFLAT TAB', 'Digestive enzyme / gas'),
  ('PANLIPASE 150MG', 'Digestive enzyme'),
  ('PANLIPASE 25000MG', 'Digestive enzyme'),
  ('PANOXIMET', 'Vitamin / mineral supplement'),
  ('PANTACEA D', 'Acidity / GERD'),
  ('PANTOCID DSR', 'Acidity / GERD'),
  ('PANTOCID L', 'Acidity / GERD'),
  ('PARAFIREN LIQUID', 'Fever & pain'),
  ('PEGOVAG SACHETS', 'Constipation / bowel preparation'),
  ('PLACENTREX GEL', 'Wound healing'),
  ('PLACIDA', 'Depression / anxiety'),
  ('PODOCIP CV', 'Antibiotic'),
  ('POWERDEW', 'Skin moisturizer'),
  ('PRAZONOL 2.5XL', 'Blood pressure / heart'),
  ('PRAZONOL 5 XL', 'Blood pressure / heart'),
  ('PREDNISOLONE 10MG', 'Steroid'),
  ('PREGABALIN M 75MG', 'Nerve pain'),
  ('PREGABANYL M', 'Nerve pain'),
  ('PREGABAWAL M 1500 SR', 'Nerve pain'),
  ('PREGEB M 75MG', 'Nerve pain'),
  ('PREGOVITA M 75MG CAPS', 'Nerve pain'),
  ('PRENURA 75 MG', 'Nerve pain'),
  ('PREVOSS NT TAB', 'Nerve pain'),
  ('PRIMOSA 1000', 'Women''s health (hormonal)'),
  ('PROLOMET XL 25MG', 'Blood pressure / heart'),
  ('PROLOMET XL 50', 'Blood pressure / heart'),
  ('PRUEASE 2MG', 'Constipation'),
  ('PRUVICT 2 TAB', 'Constipation'),
  ('PYLOFLUSH CAPSULE', 'Digestive / probiotic'),
  ('PYZINA 1000MG TAB', 'TB treatment'),
  ('QUADRA JEL', 'Mouth ulcers / oral care'),
  ('R CIN 600 CAP', 'TB treatment'),
  ('RABLET D', 'Acidity / GERD'),
  ('RALIGESIC OINT 30GMS', 'Pain relief (topical)'),
  ('RAMLAREN TAB 3861', 'Blood pressure'),
  ('REBAHEAL 100MG TAB 893', 'Peptic ulcer / gastritis'),
  ('RELASPA 50 MG', 'Menstrual / abdominal cramps'),
  ('RENERVE PLUS', 'Nerve health (B12)'),
  ('RESNER PLUS', 'Nerve pain'),
  ('RESODIM 15 TB', 'Low sodium / kidney-electrolyte'),
  ('RESWAS SYP', 'Dry cough'),
  ('RICHAR CR 100MG', 'Anemia / iron'),
  ('RICHGLOW GEL', 'Skin repair / moisturizer'),
  ('RIFAN 400 TAB', 'Gut infection / IBS'),
  ('RIFAN 550 TAB', 'Gut infection / IBS'),
  ('RIVABAN 15MG TAB', 'Blood thinner'),
  ('RIVABAN 2.5 MG', 'Blood thinner'),
  ('ROSEDAY F 10 TAB', 'Cholesterol'),
  ('ROSUVAS 10', 'Cholesterol'),
  ('ROSVASTAT 10', 'Cholesterol'),
  ('ROSYS FT TAB', 'Cholesterol'),
  ('ROZUTIN F TAB 2596', 'Cholesterol'),
  ('SAAZ 500', 'Rheumatoid arthritis / IBD'),
  ('SAAZ DS', 'Rheumatoid arthritis / IBD'),
  ('SALIXID CREAM', 'Skin care'),
  ('SEDOGEST 300 TAB 4025', 'Liver / gallstones'),
  ('SILOSWIFT 8D 1366', 'Prostate (BPH)'),
  ('SITAPLA 100', 'Diabetes'),
  ('SITAYES M 50/1000MG TAB', 'Diabetes'),
  ('SITCOM LD CREAM', 'Piles / hemorrhoids'),
  ('SODATAB 1000 MG', 'Kidney (acidosis)'),
  ('SOMPRAZ D 40MG', 'Acidity / GERD'),
  ('SONATA LR CAP', 'Sleep aid'),
  ('SPIN FREE 1655', 'Vertigo'),
  ('SPORLAC', 'Digestive / probiotic'),
  ('SUCRADAY SYP', 'Stomach ulcer'),
  ('SUMO L DS SYP', 'Cold / fever'),
  ('SUSTEN 100MG CAP', 'Pregnancy support (hormonal)'),
  ('TAMSIFLO 0.4MG 1132', 'Prostate (BPH)'),
  ('TAMSIFLO D TAB', 'Prostate (BPH)'),
  ('TAPAL ER 100 2513', 'Pain relief (strong)'),
  ('TAPAL ER 50', 'Pain relief (strong)'),
  ('TAXIM O SYRUP', 'Antibiotic'),
  ('TELINOR 40 MG TAB', 'Blood pressure'),
  ('TELKONOL TRIO', 'Blood pressure'),
  ('TELMA H TAB', 'Blood pressure'),
  ('TELSARTAN 40MG', 'Blood pressure'),
  ('TELVAS 20', 'Blood pressure'),
  ('THROMBOTAS ONT', 'Vein care (topical)'),
  ('THYRODOWM 100 MCG', 'Thyroid'),
  ('THYRONORM 125MG TAB', 'Thyroid'),
  ('THYRONORM 25MG TAB', 'Thyroid'),
  ('THYRONORM 50MG TAB', 'Thyroid'),
  ('THYROXINOL 75', 'Thyroid'),
  ('TORSEMYDE 10MG', 'Diuretic / heart'),
  ('TORSEVUE 20 MG TAB', 'Diuretic / heart'),
  ('TORTHROCIN 500', 'Antibiotic'),
  ('TRYPTOMER 10MG TAB', 'Depression / nerve pain'),
  ('TRYPTOMER 25MG TAB', 'Depression / nerve pain'),
  ('UDESTA 300', 'Liver / gallstones'),
  ('ULTRA D3 DROPS', 'Vitamin D'),
  ('ULTRANISE TAB', 'Strong pain relief'),
  ('ULYSES TAB 300 MG', 'Liver / gallstones'),
  ('UNISTAT 20 TAB', 'Cholesterol'),
  ('UNISTAT 40 TAB', 'Cholesterol'),
  ('UNOBIOTICS POWDER', 'Digestive / probiotic'),
  ('URIBID', 'Urinary tract antibiotic'),
  ('URISPAS TAB', 'Urinary bladder spasm'),
  ('URSOCOL 300 TAB', 'Liver / gallstones'),
  ('VIACHYMSIN AP', 'Swelling / inflammation'),
  ('VIAFLEC SP TAB 1673', 'Pain / inflammation'),
  ('VOMIKIND MD 4 TAB 2623', 'Nausea / vomiting'),
  ('VYMADA 50 MG', 'Heart failure'),
  ('WALYTE ORS', 'Dehydration (ORS)'),
  ('ZETAGLIM 1 MG', 'Diabetes'),
  ('ZETAGLIM 2', 'Diabetes'),
  ('ZETAGLIM M2 FORTE', 'Diabetes'),
  ('ZOLFRESH 10MG TAB 1011', 'Sleep aid'),
  ('ZOLFRESH 5MG', 'Sleep aid');

do $migration$
declare
  source_count integer;
  matched_count integer;
  non_unique_match_count integer;
begin
  select count(*)
  into source_count
  from asian_medicine_description_import;

  if source_count <> 383 then
    raise exception
      'Expected 383 imported medicine descriptions, found %',
      source_count;
  end if;

  select count(*)
  into matched_count
  from asian_medicine_description_import as source
  where exists (
    select 1
    from public.medicines as medicine
    where upper(btrim(medicine.name)) = upper(source.name)
      and upper(btrim(medicine.hospital_name)) =
        'ASIAN MULTI SPECIALITY HOSPITALS'
      and nullif(btrim(medicine.image_url), '') is not null
  );

  if matched_count <> source_count then
    raise exception
      'Only % of % imported medicine names match the Asian image catalogue',
      matched_count,
      source_count;
  end if;

  select count(*)
  into non_unique_match_count
  from (
    select source.name
    from asian_medicine_description_import as source
    join public.medicines as medicine
      on upper(btrim(medicine.name)) = upper(source.name)
     and upper(btrim(medicine.hospital_name)) =
       'ASIAN MULTI SPECIALITY HOSPITALS'
     and nullif(btrim(medicine.image_url), '') is not null
    group by source.name
    having count(*) <> 1
  ) as non_unique_matches;

  if non_unique_match_count <> 0 then
    raise exception
      '% imported medicine names do not have exactly one catalogue match',
      non_unique_match_count;
  end if;
end
$migration$;

update public.medicines as medicine
set description = source.description
from asian_medicine_description_import as source
where upper(btrim(medicine.name)) = upper(source.name)
  and upper(btrim(medicine.hospital_name)) =
    'ASIAN MULTI SPECIALITY HOSPITALS'
  and nullif(btrim(medicine.image_url), '') is not null
  and medicine.description is distinct from source.description;

do $migration$
declare
  verified_count integer;
begin
  select count(*)
  into verified_count
  from asian_medicine_description_import as source
  join public.medicines as medicine
    on upper(btrim(medicine.name)) = upper(source.name)
   and upper(btrim(medicine.hospital_name)) =
     'ASIAN MULTI SPECIALITY HOSPITALS'
   and nullif(btrim(medicine.image_url), '') is not null
   and medicine.description = source.description;

  if verified_count <> 383 then
    raise exception
      'Verified % of 383 imported medicine descriptions',
      verified_count;
  end if;
end
$migration$;
