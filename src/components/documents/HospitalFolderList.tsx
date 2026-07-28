import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import type { PatientReportHospitalGroup } from '../../lib/patientReportModel';
import { useLanguage } from '../../lib/i18n';
import { PressableScale } from '../PressableScale';

type HospitalFolderListProps = {
  groups: PatientReportHospitalGroup[];
  onOpen: (group: PatientReportHospitalGroup) => void;
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export function HospitalFolderList({
  groups,
  onOpen,
}: HospitalFolderListProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.grid}>
      {groups.map((group) => (
        <PressableScale
          accessibilityLabel={`Open ${group.hospitalName}`}
          key={group.hospitalId ?? 'unknown'}
          onPress={() => onOpen(group)}
          pressedScale={0.97}
          style={styles.card}
        >
          <View style={styles.folder}>
            <Ionicons
              color={dashboardColors.primary}
              name="folder"
              size={64}
            />
            <View style={styles.initials}>
              <Text style={styles.initialsText}>
                {getInitials(group.hospitalName)}
              </Text>
            </View>
          </View>
          <Text numberOfLines={2} style={styles.name}>
            {group.hospitalName}
          </Text>
          <Text style={styles.count}>
            {group.reports.length}{' '}
            {group.reports.length === 1
              ? t('document')
              : t('documentPlural')}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dashboardSpacing.md,
    marginTop: dashboardSpacing.gap,
  },
  card: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    padding: dashboardSpacing.md,
    width: '47.5%',
  },
  folder: {
    alignItems: 'center',
    height: 66,
    justifyContent: 'center',
    width: 84,
  },
  initials: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.primary,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    top: 21,
    width: 32,
  },
  initialsText: {
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  name: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontSize: 13,
    minHeight: 36,
    textAlign: 'center',
  },
  count: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 10,
    marginTop: 2,
  },
});
