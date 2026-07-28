import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import type { HospitalOption } from '../../lib/documentClassifier';
import { getReportTypeTranslationKey } from '../../lib/documentMenu';
import { useLanguage } from '../../lib/i18n';
import type { PatientReport } from '../../lib/patientReportModel';
import { PressableScale } from '../PressableScale';

type ReportListProps = {
  hospitals: HospitalOption[];
  deletingReportId: string | null;
  onDelete: (report: PatientReport) => void;
  onOpen: (report: PatientReport) => void;
  reports: PatientReport[];
};

export function ReportList({
  hospitals,
  deletingReportId,
  onDelete,
  onOpen,
  reports,
}: ReportListProps) {
  const { t } = useLanguage();
  const hospitalNames = new Map(
    hospitals.map((hospital) => [hospital.id, hospital.name]),
  );

  return (
    <View style={styles.list}>
      {reports.map((report) => (
        <View key={report.id} style={styles.card}>
          <PressableScale
            accessibilityLabel={
              report.reportType
                ? t(getReportTypeTranslationKey(report.reportType))
                : t('medicalDocument')
            }
            disabled={deletingReportId === report.id}
            onPress={() => onOpen(report)}
            pressedScale={0.98}
            style={styles.openArea}
          >
            <View style={styles.icon}>
              <Ionicons
                color={dashboardColors.error}
                name="document-text"
                size={23}
              />
            </View>
            <View style={styles.body}>
              <Text numberOfLines={1} style={styles.title}>
                {report.reportType
                  ? t(getReportTypeTranslationKey(report.reportType))
                  : report.label ?? t('medicalDocument')}
              </Text>
              <Text numberOfLines={1} style={styles.hospital}>
                {report.hospitalId
                  ? hospitalNames.get(report.hospitalId) ?? t('hospital')
                  : t('hospital')}
              </Text>
              <Text style={styles.meta}>
                {report.pageCount}{' '}
                {report.pageCount === 1 ? t('page') : t('pagePlural')} ·{' '}
                {new Date(report.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </PressableScale>
          <PressableScale
            accessibilityLabel={t('delete')}
            disabled={deletingReportId !== null}
            onPress={() => onDelete(report)}
            pressedScale={0.9}
            style={styles.deleteButton}
          >
            {deletingReportId === report.id ? (
              <ActivityIndicator color={dashboardColors.error} size="small" />
            ) : (
              <Ionicons
                color={dashboardColors.error}
                name="trash-outline"
                size={18}
              />
            )}
          </PressableScale>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: dashboardSpacing.md,
    marginTop: dashboardSpacing.gap,
  },
  card: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    minHeight: 82,
    position: 'relative',
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  openArea: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    minHeight: 82,
    padding: dashboardSpacing.md,
    paddingRight: 52,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.errorTint,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: dashboardSpacing.md,
    top: dashboardSpacing.md,
    width: 32,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.errorTint,
    borderRadius: 20,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  body: {
    flex: 1,
  },
  title: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 15,
  },
  hospital: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
  meta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 10,
    marginTop: 2,
  },
});
