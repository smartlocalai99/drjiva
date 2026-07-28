import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { useLanguage } from '../../lib/i18n';
import { PressableScale } from '../PressableScale';

type DocumentReviewSheetProps = {
  detectedHospitalId: string | null;
  detectedReportType: ReportType | null;
  hospitals: HospitalOption[];
  isSaving: boolean;
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
  onCancel,
  onSave,
  pageCount,
  visible,
}: DocumentReviewSheetProps) {
  const { t } = useLanguage();
  const [hospitalId, setHospitalId] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    if (visible) {
      setHospitalId(detectedHospitalId);
      setReportType(detectedReportType);
      setShowValidation(false);
    }
  }, [detectedHospitalId, detectedReportType, visible]);

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
          <ScrollView
            contentContainerStyle={styles.optionGrid}
            nestedScrollEnabled
            style={styles.hospitalList}
          >
            {hospitals.map((hospital) => (
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
                  {type}
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
  hospitalList: {
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
