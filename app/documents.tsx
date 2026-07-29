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
import { openDocumentInApp, shareDocument } from '../src/lib/documentActions';
import {
  classifyDocument,
  type HospitalOption,
  type ReportType,
} from '../src/lib/documentClassifier';
import { compressScannedPage } from '../src/lib/expoImageCompressor';
import {
  getDocumentPrimaryAction,
  getReportTypeTranslationKey,
} from '../src/lib/documentMenu';
import {
  createReportPdf,
  recognizeFirstPage,
  requestDocumentCameraAccess,
  scanDocuments,
} from '../src/lib/documentScanner';
import { getTabRoute } from '../src/lib/dashboardNav';
import { useLanguage } from '../src/lib/i18n';
import {
  createCustomHospital,
  fetchPatientCustomHospitals,
} from '../src/lib/medicineCourses';
import { getPatientByPhone } from '../src/lib/patients';
import {
  createPatientReportSignedUrl,
  deletePatientReport,
  fetchHospitals,
  fetchPatientReports,
  uploadPatientReport,
} from '../src/lib/patientReports';
import {
  groupPatientReportsByHospital,
  removePatientReport,
  type PatientReport,
} from '../src/lib/patientReportModel';
import { ensureSecureReportSession } from '../src/lib/reportAuth';
import { getReportDeletionMessageKey } from '../src/lib/reportDeletionCopy';
import { PatientReportDeletionError } from '../src/lib/deletePatientReport';

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
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [openingReportId, setOpeningReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
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
      setErrorMessage(t('patientUnavailable'));
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
      const [verifiedHospitals, customHospitals, nextReports] =
        await Promise.all([
          fetchHospitals(),
          fetchPatientCustomHospitals(patient.patientId).catch(() => []),
          fetchPatientReports(patient.patientId),
        ]);
      setPatientId(patient.patientId);
      setHospitals([...verifiedHospitals, ...customHospitals]);
      setReports(nextReports);
    } catch {
      setErrorMessage(t('unableLoadDocuments'));
    } finally {
      setIsLoading(false);
    }
  }, [phone, t]);

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
    () =>
      groupPatientReportsByHospital(visibleReports, hospitals, {
        hospital: t('hospital'),
        otherHospital: t('otherHospital'),
      }),
    [hospitals, t, visibleReports],
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

  const handleAddHospital = async (
    name: string,
  ): Promise<HospitalOption | null> => {
    if (!patientId) {
      return null;
    }
    try {
      const hospital = await createCustomHospital(patientId, name);
      setHospitals((current) => [...current, hospital]);
      return hospital;
    } catch {
      return null;
    }
  };

  const handleScan = async () => {
    if (isScanning || isSaving) {
      return;
    }
    if (!patientId) {
      Alert.alert(
        t('patientUnavailable'),
        t('reloadBeforeScanning'),
      );
      return;
    }

    setIsScanning(true);
    try {
      const cameraPermission = await requestDocumentCameraAccess();
      if (cameraPermission === 'blocked') {
        Alert.alert(
          t('cameraPermissionRequired'),
          t('cameraSettingsMessage'),
          [
            { style: 'cancel', text: t('notNow') },
            {
              onPress: () => void Linking.openSettings(),
              text: t('openSettings'),
            },
          ],
        );
        return;
      }
      if (cameraPermission === 'denied') {
        Alert.alert(
          t('cameraPermissionRequired'),
          t('cameraScanMessage'),
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
      setExtractedText(ocrText.trim());
      setDetectedHospitalId(classification.hospital?.id ?? null);
      setDetectedReportType(classification.reportType);
      setReviewVisible(true);
    } catch {
      Alert.alert(
        t('unableToScanDocument'),
        t('checkCameraAndTryAgain'),
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
      const compressedPages = await Promise.all(
        capturedPages.map((page) => compressScannedPage(page).catch(() => page)),
      );
      pdfUri = await createReportPdf(compressedPages);
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
      setExtractedText('');
      Alert.alert(t('documentSaved'), t('pdfAttached'));
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('20 MB')
          ? t('reportTooLarge')
          : t('pdfCouldNotBeSaved');
      Alert.alert(t('unableToSaveDocument'), message);
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
      Alert.alert(t('unableToOpen'), t('olderReportNoPath'));
      return;
    }
    setOpeningReportId(report.id);
    try {
      const signedUrl = await createPatientReportSignedUrl(report.storagePath);
      const opened = await openDocumentInApp(signedUrl);
      if (!opened) {
        await Linking.openURL(signedUrl);
      }
    } catch {
      Alert.alert(t('unableToOpen'), t('tryOpeningAgain'));
    } finally {
      setOpeningReportId(null);
    }
  };

  const handleShareReport = async (report: PatientReport) => {
    if (!report.storagePath) {
      Alert.alert(t('unableToOpen'), t('olderReportNoPath'));
      return;
    }
    try {
      const signedUrl = await createPatientReportSignedUrl(report.storagePath);
      const shared = await shareDocument(signedUrl);
      if (!shared) {
        Alert.alert(t('unableToOpen'), t('tryOpeningAgain'));
      }
    } catch {
      Alert.alert(t('unableToOpen'), t('tryOpeningAgain'));
    }
  };

  const handleDeleteReport = (report: PatientReport) => {
    const reportName = report.reportType
      ? t(getReportTypeTranslationKey(report.reportType))
      : report.label ?? t('medicalDocument');
    const hospitalName = report.hospitalId
      ? hospitals.find((hospital) => hospital.id === report.hospitalId)?.name ??
        t('hospital')
      : t('otherHospital');
    Alert.alert(
      t('deleteDocument'),
      `${reportName}\n${hospitalName}\n\n${t(
        getReportDeletionMessageKey(report.storagePath),
      )}`,
      [
        { style: 'cancel', text: t('cancel') },
        {
          style: 'destructive',
          text: t('delete'),
          onPress: () => {
            setDeletingReportId(report.id);
            void deletePatientReport(report)
              .then(() => {
                setReports((current) =>
                  removePatientReport(current, report.id),
                );
                Alert.alert(
                  t('documentDeleted'),
                  t('documentDeletedMessage'),
                );
              })
              .catch((error: unknown) => {
                const message =
                  error instanceof PatientReportDeletionError
                    ? error.stage === 'storage'
                      ? t('unableDeleteDocumentStorage')
                      : t('unableDeleteDocumentRecord')
                    : t('unableDeleteDocumentMessage');
                Alert.alert(
                  t('unableDeleteDocument'),
                  message,
                );
              })
              .finally(() => setDeletingReportId(null));
          },
        },
      ],
    );
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
        {selectedGroup ? (
          <View style={styles.folderHeader}>
            <PressableScale
              accessibilityLabel={t('backToHospitals')}
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
            deletingReportId={deletingReportId}
            hospitals={hospitals}
            onDelete={handleDeleteReport}
            onOpen={(report) => void handleOpenReport(report)}
            onShare={(report) => void handleShareReport(report)}
            openingReportId={openingReportId}
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
        extractedText={extractedText}
        hospitals={hospitals}
        isSaving={isSaving}
        onAddHospital={handleAddHospital}
        onCancel={() => {
          if (!isSaving) {
            setReviewVisible(false);
            setCapturedPages([]);
            setExtractedText('');
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
