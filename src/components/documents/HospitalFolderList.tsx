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
import { HospitalLogo } from '../HospitalLogo';
import { PressableScale } from '../PressableScale';

type HospitalFolderListProps = {
  groups: PatientReportHospitalGroup[];
  onOpen: (group: PatientReportHospitalGroup) => void;
};

export function HospitalFolderList({
  groups,
  onOpen,
}: HospitalFolderListProps) {
  const { t } = useLanguage();

  return (
    <View style={styles.grid}>
      {groups.map((group) => (
        <PressableScale
          accessibilityLabel={group.hospitalName}
          key={group.key}
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
            <View style={styles.logoBadge}>
              <HospitalLogo size={32} />
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
  logoBadge: {
    position: 'absolute',
    top: 21,
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
