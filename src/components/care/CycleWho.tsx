import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import type { CareCopyKey } from '../../lib/careCopy';
import { useCareCopy } from '../../lib/careCopy';
import type { CycleWho } from '../../lib/careCycle';
import { careFonts } from './careStyles';

export const WHO_COPY: Record<CycleWho, CareCopyKey> = { couple: 'whoCouple', husband: 'whoHusband', wife: 'whoWife' };

const WHO_COLORS: Record<CycleWho, { bg: string; fg: string }> = {
  couple: { bg: dashboardColors.successTint, fg: '#15803D' },
  husband: { bg: '#EEF0FB', fg: '#4338CA' },
  wife: { bg: dashboardColors.primaryTint, fg: dashboardColors.primary },
};

// Who has to come for a step: "You", "Husband" or "Both of you".
// `onTint`: white pill for rows that already have a tinted background.
export function WhoTag({ onTint = false, who }: { onTint?: boolean; who: CycleWho }) {
  const { c } = useCareCopy();
  const colors = WHO_COLORS[who];
  return (
    <View style={[styles.tag, { backgroundColor: onTint ? '#FFFFFF' : colors.bg }]}>
      <Text style={[styles.text, { color: colors.fg }]}>{c(WHO_COPY[who])}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  text: {
    fontFamily: careFonts.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
});
