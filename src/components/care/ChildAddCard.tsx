import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import type { CareChildDesk } from '../../lib/care';
import { useCareCopy } from '../../lib/careCopy';
import { PressableScale } from '../PressableScale';
import { CHILD_IMAGES } from './ChildVisitCard';
import { careFonts, careShared } from './careStyles';

// For a parent at a hospital with a child doctor and no child added yet.
export function ChildAddCard({ desk, onAdd }: { desk: CareChildDesk; onAdd: () => void }) {
  const { c } = useCareCopy();
  return (
    <View style={careShared.card}>
      <View style={styles.row}>
        <Image contentFit="contain" source={CHILD_IMAGES.smile} style={styles.photo} />
        <View style={styles.flex}>
          <Text style={careShared.cardTitle}>{c('childAddTitle')}</Text>
          <Text style={careShared.muted}>{c('childAddBody', { doctor: desk.doctorName, hospital: desk.hospitalName })}</Text>
        </View>
      </View>
      <PressableScale accessibilityRole="button" onPress={onAdd} style={styles.button}>
        <Ionicons color="#FFFFFF" name="add" size={22} />
        <Text style={styles.buttonText}>{c('childAddButton')}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderCurve: 'continuous',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: careFonts.bold,
    fontSize: 17,
  },
  flex: { flex: 1, gap: 4 },
  photo: {
    height: 104,
    width: 82,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
});
