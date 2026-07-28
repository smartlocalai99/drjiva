import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AppLanguage = 'en' | 'te';

const STORAGE_KEY = 'drjiva.language';

// First-pass Telugu copy for the screens shipped so far — please have a
// native speaker review these before they reach a wide audience.
const translations = {
  en: {
    account: 'Account',
    addDocument: 'Add document',
    addMedicine: 'Add Medicine',
    chooseHospital: 'Choose hospital',
    addNewHospital: 'Add a new hospital',
    hospitalName: 'Hospital name',
    findMedicine: 'Find medicine',
    courseDetails: 'Course details',
    tabletsPerDose: 'Tablets per dose',
    durationDays: 'Number of days',
    startDate: 'Start date (YYYY-MM-DD)',
    everyDay: 'Every day',
    alternateDays: 'Alternate days',
    reviewReminder: 'Review reminder',
    createReminder: 'Create reminder',
    reminderCreated: 'Reminder created',
    reminderCreatedMessage:
      'Your medicine course is saved and will appear on the dashboard.',
    phoneAlertsDisabled:
      'The course is saved. Enable notifications in Settings for phone alerts.',
    addToCart: 'Add to cart',
    all: 'All',
    aboutUs: 'About Us',
    backToHospitals: 'Back to hospitals',
    cameraPermissionRequired: 'Camera permission required',
    cameraScanMessage: 'Allow camera access to scan a medical document.',
    cameraSettingsMessage:
      'Allow camera access in Settings to scan medical documents.',
    cancel: 'Cancel',
    cart: 'Cart',
    cartEmptyTitle: 'Your cart is empty',
    cartEmptySubtitle: 'Items you add from Shop will appear here.',
    cartTotal: 'Total',
    checkout: 'Checkout',
    comingSoon: 'Coming soon.',
    documents: 'Documents',
    document: 'document',
    documentPlural: 'documents',
    documentSaved: 'Document saved',
    delete: 'Delete',
    deleteDocument: 'Delete document?',
    deleteDocumentMessage:
      'This permanently deletes the PDF and cannot be undone.',
    deleteLegacyDocumentMessage:
      'This older entry has no stored PDF path. Only its record will be permanently deleted.',
    deletingDocument: 'Deleting document…',
    documentDeleted: 'Document deleted',
    documentDeletedMessage: 'The PDF and its record were permanently deleted.',
    unableDeleteDocument: 'Unable to delete document',
    unableDeleteDocumentMessage:
      'The document was kept. Please check your connection and try again.',
    unableDeleteDocumentStorage:
      'The private PDF could not be removed, so its record was kept.',
    unableDeleteDocumentRecord:
      'The PDF was removed, but its record could not be cleared. Please retry.',
    dischargeSummary: 'Discharge Summary',
    documentsUnavailable: 'Documents unavailable',
    documentsEmptySubtitle:
      'Documents you add will appear here, grouped by hospital.',
    documentsEmptyTitle: 'No documents yet',
    documentsGroupedBy: 'Grouped by hospital',
    hospital: 'Hospital',
    imaging: 'Imaging',
    labReport: 'Lab Report',
    medicalDocument: 'Medical document',
    noScannedDocuments: 'No scanned documents',
    noScannedDocumentsSubtitle:
      'Scan a prescription or report and save it as one private PDF.',
    notNow: 'Not now',
    other: 'Other',
    otherHospital: 'Other hospital',
    olderReportNoPath: 'This older report has no storage path.',
    openSettings: 'Open Settings',
    openingScanner: 'Opening scanner…',
    opConsultation: 'OP Consultation',
    page: 'page',
    pagePlural: 'pages',
    patientUnavailable: 'Patient unavailable',
    pdfAttached: 'The PDF is attached to this patient.',
    pdfCouldNotBeSaved: 'The PDF could not be saved. Please try again.',
    privateMedicalPdfs: 'Private medical PDFs',
    prescription: 'Prescription',
    reloadBeforeScanning: 'Reload the Documents screen before scanning.',
    reportType: 'Report type',
    reportTooLarge: 'The report PDF must be smaller than 20 MB.',
    reviewScannedDocument: 'Review scanned document',
    savePdf: 'Save PDF',
    scanDocument: 'Scan Document',
    scanOnDevice: 'Scanning and document recognition happen on this device.',
    scannerReviewHelper:
      'We filled what could be identified on-device. Please confirm it.',
    scannerValidation: 'Choose both the hospital and report type.',
    tryAgain: 'Try again',
    tryOpeningAgain: 'Please try opening the report again.',
    unableLoadDocuments: 'Unable to load documents. Please try again.',
    unableToOpen: 'Unable to open',
    unableToSaveDocument: 'Unable to save document',
    unableToScanDocument: 'Unable to scan document',
    checkCameraAndTryAgain: 'Check camera permission and try scanning again.',
    helpCenter: 'Help Center',
    language: 'Language',
    logOut: 'Log out',
    logOutConfirm: 'Are you sure you want to log out?',
    manageProfile: 'Manage Profile',
    more: 'More',
    noMedicinesToday: 'No medicines scheduled today',
    notifications: 'Notifications',
    notificationTimings: 'Notification Timings',
    notificationTimingsHelp:
      'Set the time used for phone alerts and dashboard dose cards.',
    morning: 'Morning',
    afternoon: 'Afternoon',
    night: 'Night',
    saveTimings: 'Save timings',
    timingsSaved: 'Notification timings saved',
    oldAlertsCleanupPending:
      'Timings were saved. Old alerts will be cleaned up automatically.',
    invalidTimings: 'Use HH:MM and keep Morning before Afternoon before Night.',
    preferences: 'Preferences',
    recent: 'Recent',
    searchMedicine: 'Search medicine',
    shop: 'Shop',
    shopSubtitle: 'What medicine are you looking for?',
    support: 'Support',
    tapAddMedicine: 'Tap Add Medicine to create your first reminder.',
    today: "Today's Medicines",
    todayTab: 'Today',
  },
  te: {
    account: 'ఖాతా',
    addDocument: 'పత్రం జోడించు',
    addMedicine: 'మందు జోడించు',
    chooseHospital: 'ఆసుపత్రిని ఎంచుకోండి',
    addNewHospital: 'కొత్త ఆసుపత్రిని జోడించండి',
    hospitalName: 'ఆసుపత్రి పేరు',
    findMedicine: 'మందును వెతకండి',
    courseDetails: 'కోర్స్ వివరాలు',
    tabletsPerDose: 'ఒక్కోసారి మాత్రలు',
    durationDays: 'రోజుల సంఖ్య',
    startDate: 'ప్రారంభ తేదీ (YYYY-MM-DD)',
    everyDay: 'ప్రతి రోజు',
    alternateDays: 'ఒక రోజు విడిచి ఒక రోజు',
    reviewReminder: 'రిమైండర్‌ను పరిశీలించండి',
    createReminder: 'రిమైండర్ సృష్టించండి',
    reminderCreated: 'రిమైండర్ సృష్టించబడింది',
    reminderCreatedMessage:
      'మీ మందుల కోర్స్ సేవ్ అయింది మరియు డ్యాష్‌బోర్డ్‌లో కనిపిస్తుంది.',
    phoneAlertsDisabled:
      'కోర్స్ సేవ్ అయింది. ఫోన్ అలర్ట్‌ల కోసం సెట్టింగ్‌లలో నోటిఫికేషన్‌లను ఆన్ చేయండి.',
    addToCart: 'కార్ట్‌కు జోడించు',
    all: 'అన్నీ',
    aboutUs: 'మా గురించి',
    backToHospitals: 'ఆసుపత్రులకు తిరిగి వెళ్లండి',
    cameraPermissionRequired: 'కెమెరా అనుమతి అవసరం',
    cameraScanMessage: 'వైద్య పత్రాన్ని స్కాన్ చేయడానికి కెమెరా అనుమతిని ఇవ్వండి.',
    cameraSettingsMessage:
      'వైద్య పత్రాలను స్కాన్ చేయడానికి సెట్టింగ్‌లలో కెమెరా అనుమతిని ఇవ్వండి.',
    cancel: 'రద్దు చేయండి',
    cart: 'కార్ట్',
    cartEmptyTitle: 'మీ కార్ట్ ఖాళీగా ఉంది',
    cartEmptySubtitle: 'షాప్ నుండి జోడించిన వస్తువులు ఇక్కడ కనిపిస్తాయి.',
    cartTotal: 'మొత్తం',
    checkout: 'చెక్అవుట్',
    comingSoon: 'త్వరలో వస్తుంది.',
    documents: 'పత్రాలు',
    document: 'పత్రం',
    documentPlural: 'పత్రాలు',
    documentSaved: 'పత్రం సేవ్ అయింది',
    delete: 'తొలగించండి',
    deleteDocument: 'పత్రాన్ని తొలగించాలా?',
    deleteDocumentMessage:
      'ఇది PDFను శాశ్వతంగా తొలగిస్తుంది. తిరిగి పొందడం సాధ్యం కాదు.',
    deleteLegacyDocumentMessage:
      'ఈ పాత నమోదుకు PDF మార్గం లేదు. నమోదు మాత్రమే శాశ్వతంగా తొలగించబడుతుంది.',
    deletingDocument: 'పత్రాన్ని తొలగిస్తోంది…',
    documentDeleted: 'పత్రం తొలగించబడింది',
    documentDeletedMessage: 'PDF మరియు దాని నమోదు శాశ్వతంగా తొలగించబడ్డాయి.',
    unableDeleteDocument: 'పత్రాన్ని తొలగించలేకపోయాము',
    unableDeleteDocumentMessage:
      'పత్రం అలాగే ఉంచబడింది. కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.',
    unableDeleteDocumentStorage:
      'ప్రైవేట్ PDF తొలగించబడలేదు, కాబట్టి దాని నమోదు అలాగే ఉంచబడింది.',
    unableDeleteDocumentRecord:
      'PDF తొలగించబడింది, కానీ నమోదు తొలగించబడలేదు. మళ్లీ ప్రయత్నించండి.',
    dischargeSummary: 'డిశ్చార్జ్ సారాంశం',
    documentsUnavailable: 'పత్రాలు అందుబాటులో లేవు',
    documentsEmptySubtitle:
      'మీరు జోడించే పత్రాలు ఇక్కడ, ఆసుపత్రి వారీగా కనిపిస్తాయి.',
    documentsEmptyTitle: 'ఇంకా పత్రాలు లేవు',
    documentsGroupedBy: 'ఆసుపత్రి వారీగా గ్రూప్ చేయబడింది',
    hospital: 'ఆసుపత్రి',
    imaging: 'ఇమేజింగ్',
    labReport: 'ల్యాబ్ రిపోర్ట్',
    medicalDocument: 'వైద్య పత్రం',
    noScannedDocuments: 'స్కాన్ చేసిన పత్రాలు లేవు',
    noScannedDocumentsSubtitle:
      'ప్రిస్క్రిప్షన్ లేదా రిపోర్ట్‌ను స్కాన్ చేసి ఒక ప్రైవేట్ PDFగా సేవ్ చేయండి.',
    notNow: 'ఇప్పుడు వద్దు',
    other: 'ఇతర',
    otherHospital: 'ఇతర ఆసుపత్రి',
    olderReportNoPath: 'ఈ పాత రిపోర్ట్‌కు స్టోరేజ్ మార్గం లేదు.',
    openSettings: 'సెట్టింగ్‌లు తెరవండి',
    openingScanner: 'స్కానర్ తెరుస్తోంది…',
    opConsultation: 'OP సంప్రదింపు',
    page: 'పేజీ',
    pagePlural: 'పేజీలు',
    patientUnavailable: 'రోగి అందుబాటులో లేరు',
    pdfAttached: 'PDF ఈ రోగికి జత చేయబడింది.',
    pdfCouldNotBeSaved: 'PDF సేవ్ కాలేదు. మళ్లీ ప్రయత్నించండి.',
    privateMedicalPdfs: 'ప్రైవేట్ వైద్య PDFలు',
    prescription: 'ప్రిస్క్రిప్షన్',
    reloadBeforeScanning: 'స్కాన్ చేసే ముందు పత్రాల స్క్రీన్‌ను మళ్లీ లోడ్ చేయండి.',
    reportType: 'రిపోర్ట్ రకం',
    reportTooLarge: 'రిపోర్ట్ PDF 20 MB కంటే తక్కువగా ఉండాలి.',
    reviewScannedDocument: 'స్కాన్ చేసిన పత్రాన్ని పరిశీలించండి',
    savePdf: 'PDF సేవ్ చేయండి',
    scanDocument: 'పత్రాన్ని స్కాన్ చేయండి',
    scanOnDevice: 'స్కానింగ్ మరియు పత్ర గుర్తింపు ఈ పరికరంలోనే జరుగుతాయి.',
    scannerReviewHelper:
      'పరికరంలో గుర్తించిన వివరాలను నింపాము. దయచేసి నిర్ధారించండి.',
    scannerValidation: 'ఆసుపత్రి మరియు రిపోర్ట్ రకాన్ని ఎంచుకోండి.',
    tryAgain: 'మళ్లీ ప్రయత్నించండి',
    tryOpeningAgain: 'రిపోర్ట్‌ను మళ్లీ తెరవడానికి ప్రయత్నించండి.',
    unableLoadDocuments: 'పత్రాలను లోడ్ చేయలేకపోయాము. మళ్లీ ప్రయత్నించండి.',
    unableToOpen: 'తెరవలేకపోయాము',
    unableToSaveDocument: 'పత్రాన్ని సేవ్ చేయలేకపోయాము',
    unableToScanDocument: 'పత్రాన్ని స్కాన్ చేయలేకపోయాము',
    checkCameraAndTryAgain:
      'కెమెరా అనుమతిని తనిఖీ చేసి మళ్లీ స్కాన్ చేయండి.',
    helpCenter: 'సహాయ కేంద్రం',
    language: 'భాష',
    logOut: 'లాగ్ అవుట్',
    logOutConfirm: 'మీరు లాగ్ అవుట్ కావాలనుకుంటున్నారా?',
    manageProfile: 'ప్రొఫైల్‌ను నిర్వహించండి',
    more: 'మరిన్ని',
    noMedicinesToday: 'ఈరోజు మందులు షెడ్యూల్ చేయలేదు',
    notifications: 'నోటిఫికేషన్‌లు',
    notificationTimings: 'నోటిఫికేషన్ సమయాలు',
    notificationTimingsHelp:
      'ఫోన్ అలర్ట్‌లు మరియు డ్యాష్‌బోర్డ్ మందుల కోసం సమయాలను సెట్ చేయండి.',
    morning: 'ఉదయం',
    afternoon: 'మధ్యాహ్నం',
    night: 'రాత్రి',
    saveTimings: 'సమయాలను సేవ్ చేయండి',
    timingsSaved: 'నోటిఫికేషన్ సమయాలు సేవ్ అయ్యాయి',
    oldAlertsCleanupPending:
      'సమయాలు సేవ్ అయ్యాయి. పాత అలర్ట్‌లు ఆటోమేటిక్‌గా తొలగించబడతాయి.',
    invalidTimings:
      'HH:MM ఉపయోగించి ఉదయం, మధ్యాహ్నం, రాత్రి క్రమంలో ఉంచండి.',
    preferences: 'ప్రాధాన్యతలు',
    recent: 'ఇటీవలివి',
    searchMedicine: 'మందు వెతకండి',
    shop: 'షాప్',
    shopSubtitle: 'మీరు ఏ మందు కోసం చూస్తున్నారు?',
    support: 'మద్దతు',
    tapAddMedicine:
      "మీ మొదటి రిమైండర్‌ను సృష్టించడానికి 'మందు జోడించు'ని నొక్కండి.",
    today: 'ఈరోజు మందులు',
    todayTab: 'ఈరోజు',
  },
} as const satisfies Record<AppLanguage, Record<string, string>>;

export type TranslationKey = keyof (typeof translations)['en'];

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'en' || stored === 'te') {
          setLanguageState(stored);
        }
      })
      .catch(() => undefined);
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const t = useCallback<LanguageContextValue['t']>(
    (key) => translations[language][key],
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
