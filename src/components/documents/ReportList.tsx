import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import type { HospitalOption } from '../../lib/documentClassifier';
import type { PatientReport } from '../../lib/patientReportModel';
import { PressableScale } from '../PressableScale';

type ReportListProps = {
  hospitals: HospitalOption[];
  onOpen: (report: PatientReport) => void;
  reports: PatientReport[];
};

export function ReportList({
  hospitals,
  onOpen,
  reports,
}: ReportListProps) {
  const hospitalNames = new Map(
    hospitals.map((hospital) => [hospital.id, hospital.name]),
  );

  return (
    <View style={styles.list}>
      {reports.map((report) => (
        <PressableScale
          accessibilityLabel={`Open ${report.reportType ?? 'document'}`}
          key={report.id}
          onPress={() => onOpen(report)}
          pressedScale={0.98}
          style={styles.card}
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
              {report.reportType ?? report.label ?? 'Medical document'}
            </Text>
            <Text numberOfLines={1} style={styles.hospital}>
              {report.hospitalId
                ? hospitalNames.get(report.hospitalId) ?? 'Hospital'
                : 'Hospital'}
            </Text>
            <Text style={styles.meta}>
              {report.pageCount} {report.pageCount === 1 ? 'page' : 'pages'} ·{' '}
              {new Date(report.createdAt).toLocaleDateString()}
            </Text>
          </View>
          <Ionicons
            color={dashboardColors.textFaint}
            name="chevron-forward"
            size={18}
          />
        </PressableScale>
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
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    minHeight: 82,
    padding: dashboardSpacing.md,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
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
