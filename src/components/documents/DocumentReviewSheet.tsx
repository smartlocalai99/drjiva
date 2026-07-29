import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  REPORT_TYPES,
  type HospitalOption,
  type ReportType,
} from '../../lib/documentClassifier';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { getReportTypeTranslationKey } from '../../lib/documentMenu';
import { useLanguage } from '../../lib/i18n';
import {
  filterMedicineCatalogue,
  getNewCatalogueEntryName,
} from '../../lib/medicineSearch';
import { PressableScale } from '../PressableScale';

type DocumentReviewSheetProps = {
  detectedHospitalId: string | null;
  detectedReportType: ReportType | null;
  hospitals: HospitalOption[];
  isSaving: boolean;
  onAddHospital: (name: string) => Promise<HospitalOption | null>;
  onCancel: () => void;
  onSave: (input: {
    hospitalId: string;
    reportType: ReportType;
  }) => void;
  pageCount: number;
  visible: boolean;
};

export function DocumentReviewSheet({
  detectedHospitalId,
  detectedReportType,
  hospitals,
  isSaving,
  onAddHospital,
  onCancel,
  onSave,
  pageCount,
  visible,
}: DocumentReviewSheetProps) {
  const { t } = useLanguage();
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [isAddingHospital, setIsAddingHospital] = useState(false);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (visible) {
      setHospitalId(detectedHospitalId);
      setReportType(detectedReportType);
      setHospitalQuery('');
      setShowValidation(false);
    }
  }, [detectedHospitalId, detectedReportType, visible]);

  const hospitalResults = filterMedicineCatalogue(hospitals, hospitalQuery, 100);
  const newHospitalName = getNewCatalogueEntryName(hospitals, hospitalQuery);

  const handleAddHospital = async () => {
    if (!newHospitalName || isAddingHospital) {
      return;
    }
    setIsAddingHospital(true);
    try {
      const hospital = await onAddHospital(newHospitalName);
      if (hospital) {
        setHospitalId(hospital.id);
        setHospitalQuery('');
        setShowValidation(false);
      }
    } finally {
      setIsAddingHospital(false);
    }
  };

  const handleSave = () => {
    if (!hospitalId || !reportType) {
      setShowValidation(true);
      return;
    }
    onSave({ hospitalId, reportType });
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={isSaving ? undefined : onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel={t('cancel')}
          disabled={isSaving}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>{t('reviewScannedDocument')}</Text>
              <Text style={styles.subtitle}>
                {pageCount}{' '}
                {pageCount === 1 ? t('page') : t('pagePlural')}
              </Text>
            </View>
            <View style={styles.scanBadge}>
              <Ionicons
                color={dashboardColors.primary}
                name="scan-outline"
                size={22}
              />
            </View>
          </View>

          <Text style={styles.label}>{t('hospital')}</Text>
          <View style={styles.searchBox}>
            <Ionicons color={dashboardColors.textFaint} name="search" size={16} />
            <TextInput
              accessibilityLabel="Search or add a hospital"
              onChangeText={(value) => {
                setHospitalQuery(value);
                setShowValidation(false);
              }}
              placeholder="Search or add a hospital"
              placeholderTextColor={dashboardColors.textFaint}
              style={styles.searchInput}
              value={hospitalQuery}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.optionGrid}
            nestedScrollEnabled
            style={styles.hospitalList}
          >
            {hospitalResults.map((hospital) => (
              <PressableScale
                key={hospital.id}
                onPress={() => {
                  setHospitalId(hospital.id);
                  setShowValidation(false);
                }}
                pressedScale={0.98}
                style={[
                  styles.option,
                  hospitalId === hospital.id && styles.optionSelected,
                ]}
              >
                <Ionicons
                  color={
                    hospitalId === hospital.id
                      ? dashboardColors.primary
                      : dashboardColors.textMuted
                  }
                  name="business-outline"
                  size={16}
                />
                <Text
                  numberOfLines={2}
                  style={[
                    styles.optionText,
                    hospitalId === hospital.id && styles.optionTextSelected,
                  ]}
                >
                  {hospital.name}
                </Text>
              </PressableScale>
            ))}
            {newHospitalName ? (
              <PressableScale
                disabled={isAddingHospital}
                onPress={() => void handleAddHospital()}
                pressedScale={0.98}
                style={styles.option}
              >
                {isAddingHospital ? (
                  <ActivityIndicator color={dashboardColors.primary} size="small" />
                ) : (
                  <Ionicons
                    color={dashboardColors.primary}
                    name="add-circle-outline"
                    size={16}
                  />
                )}
                <Text numberOfLines={1} style={styles.optionText}>
                  Add “{newHospitalName}”
                </Text>
              </PressableScale>
            ) : null}
            {hospitalResults.length === 0 && !newHospitalName ? (
              <Text style={styles.emptyHospitals}>No hospitals found</Text>
            ) : null}
          </ScrollView>

          <Text style={styles.label}>{t('reportType')}</Text>
          <View style={styles.typeGrid}>
            {REPORT_TYPES.map((type) => (
              <PressableScale
                key={type}
                onPress={() => {
                  setReportType(type);
                  setShowValidation(false);
                }}
                pressedScale={0.97}
                style={[
                  styles.typeOption,
                  reportType === type && styles.optionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    reportType === type && styles.optionTextSelected,
                  ]}
                >
                  {t(getReportTypeTranslationKey(type))}
                </Text>
              </PressableScale>
            ))}
          </View>

          {showValidation ? (
            <Text style={styles.error}>
              {t('scannerValidation')}
            </Text>
          ) : (
            <Text style={styles.helper}>
              {t('scannerReviewHelper')}
            </Text>
          )}

          <View style={styles.actions}>
            <PressableScale
              disabled={isSaving}
              onPress={onCancel}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </PressableScale>
            <PressableScale
              disabled={isSaving}
              onPress={handleSave}
              style={styles.saveButton}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons color="#FFFFFF" name="cloud-upload" size={18} />
                  <Text style={styles.saveText}>{t('savePdf')}</Text>
                </>
              )}
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15,23,42,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: dashboardColors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: 28,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: dashboardColors.track,
    borderRadius: 2,
    height: 4,
    marginBottom: dashboardSpacing.gap,
    width: 42,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  subtitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
  scanBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  label: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    marginBottom: dashboardSpacing.sm,
    marginTop: dashboardSpacing.gap,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 10,
  },
  searchInput: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  emptyHospitals: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    paddingVertical: dashboardSpacing.sm,
    textAlign: 'center',
  },
  hospitalList: {
    marginTop: dashboardSpacing.sm,
    maxHeight: 145,
  },
  optionGrid: {
    gap: dashboardSpacing.sm,
  },
  option: {
    alignItems: 'center',
    backgroundColor: dashboardColors.bg,
    borderColor: 'transparent',
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    minHeight: 46,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: dashboardSpacing.sm,
  },
  optionSelected: {
    backgroundColor: dashboardColors.primaryTint,
    borderColor: dashboardColors.primary,
  },
  optionText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    flexShrink: 1,
  },
  optionTextSelected: {
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_600SemiBold',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dashboardSpacing.sm,
  },
  typeOption: {
    backgroundColor: dashboardColors.bg,
    borderColor: 'transparent',
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 9,
  },
  helper: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.md,
    minHeight: 32,
  },
  error: {
    ...dashboardTypography.caption,
    color: dashboardColors.error,
    marginTop: dashboardSpacing.md,
    minHeight: 32,
  },
  actions: {
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    marginTop: dashboardSpacing.sm,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.button,
    borderWidth: 1,
    flex: 0.8,
    justifyContent: 'center',
    minHeight: 52,
  },
  cancelText: {
    ...dashboardTypography.button,
    color: dashboardColors.text,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    flex: 1.2,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  saveText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
});
