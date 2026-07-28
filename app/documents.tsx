import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { FloatingAddButton } from '../src/components/dashboard/FloatingAddButton';
import { DocumentReviewSheet } from '../src/components/documents/DocumentReviewSheet';
import { HospitalFolderList } from '../src/components/documents/HospitalFolderList';
import { ReportList } from '../src/components/documents/ReportList';
import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import {
  classifyDocument,
  type HospitalOption,
  type ReportType,
} from '../src/lib/documentClassifier';
import { getDocumentPrimaryAction } from '../src/lib/documentMenu';
import {
  createReportPdf,
  recognizeFirstPage,
  requestDocumentCameraAccess,
  scanDocuments,
} from '../src/lib/documentScanner';
import { getTabRoute } from '../src/lib/dashboardNav';
import { useLanguage } from '../src/lib/i18n';
import { getPatientByPhone } from '../src/lib/patients';
import {
  createPatientReportSignedUrl,
  fetchHospitals,
  fetchPatientReports,
  uploadPatientReport,
} from '../src/lib/patientReports';
import {
  groupPatientReportsByHospital,
  type PatientReport,
} from '../src/lib/patientReportModel';
import { ensureSecureReportSession } from '../src/lib/reportAuth';

const FILTERS = ['All', 'Recent'] as const;
type Filter = (typeof FILTERS)[number];

export default function DocumentsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const insets = useSafeAreaInsets();
  const action = getDocumentPrimaryAction();

  const [activeTab, setActiveTab] = useState<NavTabKey>('documents');
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  const [detectedHospitalId, setDetectedHospitalId] = useState<string | null>(
    null,
  );
  const [detectedReportType, setDetectedReportType] =
    useState<ReportType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('All');
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [selectedHospitalKey, setSelectedHospitalKey] =
    useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!phone) {
      setErrorMessage('Patient phone number is unavailable.');
      setIsLoading(false);
      return;
    }

    try {
      setErrorMessage(null);
      await ensureSecureReportSession();
      const patient = await getPatientByPhone(phone);
      if (!patient) {
        throw new Error('Patient profile is unavailable.');
      }
      const [nextHospitals, nextReports] = await Promise.all([
        fetchHospitals(),
        fetchPatientReports(patient.patientId),
      ]);
      setPatientId(patient.patientId);
      setHospitals(nextHospitals);
      setReports(nextReports);
    } catch {
      setErrorMessage('Unable to load documents. Pull down or try again.');
    } finally {
      setIsLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const visibleReports = useMemo(() => {
    if (filter === 'All') {
      return reports;
    }
    const recentBoundary = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return reports.filter(
      (report) => new Date(report.createdAt).getTime() >= recentBoundary,
    );
  }, [filter, reports]);
  const reportGroups = useMemo(
    () => groupPatientReportsByHospital(visibleReports, hospitals),
    [hospitals, visibleReports],
  );
  const selectedGroup =
    reportGroups.find(
      (group) =>
        (group.hospitalId ?? 'unknown') === selectedHospitalKey,
    ) ?? null;

  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const addButtonBottomOffset =
    navBottomOffset + dashboardLayout.bottomNavHeight + 12;
  const scrollBottomPadding =
    addButtonBottomOffset + dashboardLayout.floatingButtonHeight + 24;

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === activeTab) {
      return;
    }
    const route = getTabRoute(tab);
    if (!route) {
      return;
    }
    setActiveTab(tab);
    router.replace({ params: { phone }, pathname: route });
  };

  const handleScan = async () => {
    if (isScanning || isSaving) {
      return;
    }
    if (!patientId) {
      Alert.alert(
        'Patient unavailable',
        'Reload the Documents screen before scanning.',
      );
      return;
    }

    setIsScanning(true);
    try {
      const cameraPermission = await requestDocumentCameraAccess();
      if (cameraPermission === 'blocked') {
        Alert.alert(
          'Camera permission required',
          'Allow camera access in Settings to scan medical documents.',
          [
            { style: 'cancel', text: 'Not now' },
            {
              onPress: () => void Linking.openSettings(),
              text: 'Open Settings',
            },
          ],
        );
        return;
      }
      if (cameraPermission === 'denied') {
        Alert.alert(
          'Camera permission required',
          'Allow camera access to scan a medical document.',
        );
        return;
      }

      const pages = await scanDocuments();
      if (!pages) {
        return;
      }
      const ocrText = await recognizeFirstPage(pages[0]!).catch(() => '');
      const classification = classifyDocument(ocrText, hospitals);
      setCapturedPages(pages);
      setDetectedHospitalId(classification.hospital?.id ?? null);
      setDetectedReportType(classification.reportType);
      setReviewVisible(true);
    } catch {
      Alert.alert(
        'Unable to scan document',
        'Check camera permission and try scanning again.',
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async (metadata: {
    hospitalId: string;
    reportType: ReportType;
  }) => {
    if (!patientId || capturedPages.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    let pdfUri: string | null = null;
    try {
      pdfUri = await createReportPdf(capturedPages);
      const report = await uploadPatientReport({
        hospitalId: metadata.hospitalId,
        label: metadata.reportType,
        pageCount: capturedPages.length,
        patientId,
        pdfUri,
        reportType: metadata.reportType,
      });
      setReports((current) => [report, ...current]);
      setReviewVisible(false);
      setCapturedPages([]);
      Alert.alert('Document saved', 'The PDF is attached to this patient.');
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('20 MB')
          ? error.message
          : 'The PDF could not be saved. Please try again.';
      Alert.alert('Unable to save document', message);
    } finally {
      if (pdfUri) {
        const pdf = new File(pdfUri);
        if (pdf.exists) {
          pdf.delete();
        }
      }
      setIsSaving(false);
    }
  };

  const handleOpenReport = async (report: PatientReport) => {
    if (!report.storagePath) {
      Alert.alert('Unable to open', 'This older report has no storage path.');
      return;
    }
    try {
      const signedUrl = await createPatientReportSignedUrl(report.storagePath);
      await Linking.openURL(signedUrl);
    } catch {
      Alert.alert('Unable to open', 'Please try opening the report again.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>{t('documents')}</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          visibleReports.length === 0 && styles.contentEmpty,
          { paddingBottom: scrollBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons
              color={dashboardColors.primary}
              name="shield-checkmark-outline"
              size={20}
            />
          </View>
          <View style={styles.introBody}>
            <Text style={styles.introTitle}>{t('privateMedicalPdfs')}</Text>
            <Text style={styles.introText}>
              {t('scanOnDevice')}
            </Text>
          </View>
        </View>

        {selectedGroup ? (
          <View style={styles.folderHeader}>
            <PressableScale
              accessibilityLabel="Back to hospitals"
              onPress={() => setSelectedHospitalKey(null)}
              style={styles.backButton}
            >
              <Ionicons
                color={dashboardColors.text}
                name="chevron-back"
                size={20}
              />
            </PressableScale>
            <View style={styles.folderHeaderBody}>
              <Text numberOfLines={1} style={styles.folderTitle}>
                {selectedGroup.hospitalName}
              </Text>
              <Text style={styles.folderSubtitle}>
                {selectedGroup.reports.length}{' '}
                {selectedGroup.reports.length === 1
                  ? t('document')
                  : t('documentPlural')}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.filterRow}>
            {FILTERS.map((option) => (
              <PressableScale
                key={option}
                onPress={() => setFilter(option)}
                pressedScale={0.95}
                style={[
                  styles.filterChip,
                  filter === option && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === option && styles.filterChipTextActive,
                  ]}
                >
                  {option === 'All' ? t('all') : t('recent')}
                </Text>
              </PressableScale>
            ))}
          </View>
        )}

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={dashboardColors.primary} />
          </View>
        ) : errorMessage ? (
          <View style={styles.center}>
            <Ionicons
              color={dashboardColors.error}
              name="cloud-offline-outline"
              size={38}
            />
            <Text style={styles.emptyTitle}>
              {t('documentsUnavailable')}
            </Text>
            <Text style={styles.emptySubtitle}>{errorMessage}</Text>
            <PressableScale onPress={() => void loadDocuments()} style={styles.retry}>
              <Text style={styles.retryText}>{t('tryAgain')}</Text>
            </PressableScale>
          </View>
        ) : visibleReports.length === 0 ? (
          <EmptyDocuments />
        ) : selectedGroup ? (
          <ReportList
            hospitals={hospitals}
            onOpen={(report) => void handleOpenReport(report)}
            reports={selectedGroup.reports}
          />
        ) : (
          <HospitalFolderList
            groups={reportGroups}
            onOpen={(group) =>
              setSelectedHospitalKey(group.hospitalId ?? 'unknown')
            }
          />
        )}
      </ScrollView>

      <FloatingAddButton
        bottomOffset={addButtonBottomOffset}
        icon={isScanning ? 'hourglass-outline' : action.icon}
        label={isScanning ? t('openingScanner') : t('scanDocument')}
        onPress={() => void handleScan()}
      />

      <BottomNav
        activeTab={activeTab}
        bottomOffset={navBottomOffset}
        onSelectTab={handleSelectTab}
      />

      <DocumentReviewSheet
        detectedHospitalId={detectedHospitalId}
        detectedReportType={detectedReportType}
        hospitals={hospitals}
        isSaving={isSaving}
        onCancel={() => {
          if (!isSaving) {
            setReviewVisible(false);
            setCapturedPages([]);
          }
        }}
        onSave={(metadata) => void handleSave(metadata)}
        pageCount={capturedPages.length}
        visible={reviewVisible}
      />
    </SafeAreaView>
  );
}

function EmptyDocuments() {
  const { t } = useLanguage();

  return (
    <View style={styles.center}>
      <View style={styles.emptyIcon}>
        <Ionicons
          color={dashboardColors.primary}
          name="scan-outline"
          size={42}
        />
      </View>
      <Text style={styles.emptyTitle}>{t('noScannedDocuments')}</Text>
      <Text style={styles.emptySubtitle}>
        {t('noScannedDocumentsSubtitle')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.sm,
  },
  headerSide: {
    height: 32,
    width: 32,
  },
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  content: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  intro: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.card,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    marginTop: dashboardSpacing.sm,
    padding: dashboardSpacing.md,
  },
  introIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  introBody: {
    flex: 1,
  },
  introTitle: {
    ...dashboardTypography.body,
    color: dashboardColors.primaryDark,
  },
  introText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 1,
  },
  folderHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    marginTop: dashboardSpacing.gap,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  folderHeaderBody: {
    flex: 1,
  },
  folderTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
  },
  folderSubtitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    marginTop: dashboardSpacing.gap,
  },
  filterChip: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.pill,
    paddingHorizontal: dashboardSpacing.gap,
    paddingVertical: dashboardSpacing.sm,
  },
  filterChipActive: {
    backgroundColor: dashboardColors.text,
  },
  filterChipText: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 360,
    paddingHorizontal: dashboardSpacing.xl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    marginBottom: dashboardSpacing.gap,
    width: 72,
  },
  emptyTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    marginTop: dashboardSpacing.gap,
    paddingHorizontal: dashboardSpacing.xl,
    paddingVertical: dashboardSpacing.md,
  },
  retryText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
});
