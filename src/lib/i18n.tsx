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
    addToCart: 'Add to cart',
    all: 'All',
    aboutUs: 'About Us',
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
    documentsUnavailable: 'Documents unavailable',
    documentsEmptySubtitle:
      'Documents you add will appear here, grouped by hospital.',
    documentsEmptyTitle: 'No documents yet',
    documentsGroupedBy: 'Grouped by hospital',
    noScannedDocuments: 'No scanned documents',
    noScannedDocumentsSubtitle:
      'Scan a prescription or report and save it as one private PDF.',
    openingScanner: 'Opening scanner…',
    privateMedicalPdfs: 'Private medical PDFs',
    scanDocument: 'Scan Document',
    scanOnDevice: 'Scanning and document recognition happen on this device.',
    tryAgain: 'Try again',
    helpCenter: 'Help Center',
    language: 'Language',
    logOut: 'Log out',
    logOutConfirm: 'Are you sure you want to log out?',
    manageProfile: 'Manage Profile',
    more: 'More',
    noMedicinesToday: 'No medicines scheduled today',
    notifications: 'Notifications',
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
    addToCart: 'కార్ట్‌కు జోడించు',
    all: 'అన్నీ',
    aboutUs: 'మా గురించి',
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
    documentsUnavailable: 'పత్రాలు అందుబాటులో లేవు',
    documentsEmptySubtitle:
      'మీరు జోడించే పత్రాలు ఇక్కడ, ఆసుపత్రి వారీగా కనిపిస్తాయి.',
    documentsEmptyTitle: 'ఇంకా పత్రాలు లేవు',
    documentsGroupedBy: 'ఆసుపత్రి వారీగా గ్రూప్ చేయబడింది',
    noScannedDocuments: 'స్కాన్ చేసిన పత్రాలు లేవు',
    noScannedDocumentsSubtitle:
      'ప్రిస్క్రిప్షన్ లేదా రిపోర్ట్‌ను స్కాన్ చేసి ఒక ప్రైవేట్ PDFగా సేవ్ చేయండి.',
    openingScanner: 'స్కానర్ తెరుస్తోంది…',
    privateMedicalPdfs: 'ప్రైవేట్ వైద్య PDFలు',
    scanDocument: 'పత్రాన్ని స్కాన్ చేయండి',
    scanOnDevice: 'స్కానింగ్ మరియు పత్ర గుర్తింపు ఈ పరికరంలోనే జరుగుతాయి.',
    tryAgain: 'మళ్లీ ప్రయత్నించండి',
    helpCenter: 'సహాయ కేంద్రం',
    language: 'భాష',
    logOut: 'లాగ్ అవుట్',
    logOutConfirm: 'మీరు లాగ్ అవుట్ కావాలనుకుంటున్నారా?',
    manageProfile: 'ప్రొఫైల్‌ను నిర్వహించండి',
    more: 'మరిన్ని',
    noMedicinesToday: 'ఈరోజు మందులు షెడ్యూల్ చేయలేదు',
    notifications: 'నోటిఫికేషన్‌లు',
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
