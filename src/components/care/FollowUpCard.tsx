import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import type { CareFollowup } from '../../lib/care';
import { useCareCopy } from '../../lib/careCopy';
import { daysUntil, dialableIndianPhone, type CareVisit } from '../../lib/careSchedule';
import { DoctorAvatar } from '../DoctorAvatar';
import { HospitalLogo } from '../HospitalLogo';
import { CallButton } from './CallButton';
import { careFonts, careShared } from './careStyles';

// Always the first card: when to go back, where, and who set it.
export function FollowUpCard({ followup, today, visit }: { followup: CareFollowup | null | undefined; today: string; visit: CareVisit | null }) {
  const { c, date, pick } = useCareCopy();

  if (!followup) {
    return (
      <View style={[careShared.card, styles.emptyCard]}>
        <View style={styles.emptyIcon}>
          <Ionicons color={dashboardColors.primary} name="calendar-outline" size={26} />
        </View>
        <View style={styles.flex}>
          <Text style={careShared.label}>{c('nextVisit')}</Text>
          <Text style={careShared.body}>{c('noDateYet')}</Text>
        </View>
      </View>
    );
  }

  const days = daysUntil(followup.nextDate, today);
  const when = days <= 0 ? c('today') : days === 1 ? c('tomorrow') : c('inDays', { n: days });
  const phone = dialableIndianPhone(followup.hospital.phone);
  const visitItems = visit?.items.filter((item) => !item.conditional).slice(0, 4) ?? [];

  return (
    <View accessibilityLabel={`${c('nextVisit')}: ${date(followup.nextDate, 'weekdayDayMonth')}, ${when}`} style={careShared.card}>
      <View style={styles.topRow}>
        <Text style={careShared.label}>{c('nextVisit')}</Text>
        <View style={[styles.whenPill, days <= 1 && styles.whenPillSoon]}>
          <Text style={[styles.whenText, days <= 1 && styles.whenTextSoon]}>{when}</Text>
        </View>
      </View>

      <Text style={styles.date}>{date(followup.nextDate, 'weekdayDayMonth')}</Text>

      <View style={styles.placeRow}>
        {followup.doctorName ? (
          <DoctorAvatar doctorName={followup.doctorName} hospitalName={followup.hospital.name} size={56} />
        ) : (
          <HospitalLogo hospitalName={followup.hospital.name} logoUrl={followup.hospital.logoUrl} roundedSquare size={40} />
        )}
        <View style={styles.flex}>
          {followup.doctorName ? <Text style={styles.doctor}>{followup.doctorName}</Text> : null}
          <View style={styles.hospitalRow}>
            {followup.doctorName ? (
              <HospitalLogo hospitalName={followup.hospital.name} logoUrl={followup.hospital.logoUrl} roundedSquare size={24} />
            ) : null}
            <Text style={[careShared.muted, styles.flex]}>{followup.hospital.name}</Text>
          </View>
        </View>
      </View>

      {visitItems.length > 0 && visit ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>{c('atThisVisit')} · {pick(visit.titleEn, visit.titleTe)}</Text>
          {visitItems.map((item) => (
            <View key={item.id} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={[careShared.body, styles.flex]}>{pick(item.labelEn, item.labelTe)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {followup.note ? (
        <View style={styles.note}>
          <Text style={styles.noteTitle}>{c('nurseNote')}</Text>
          <Text style={careShared.body}>{followup.note}</Text>
        </View>
      ) : null}

      <View style={styles.nurseRow}>
        <Ionicons color={dashboardColors.textMuted} name="person-circle-outline" size={20} />
        <Text style={[careShared.muted, styles.flex]}>
          {c('updatedBy', { date: date(followup.updatedAt.slice(0, 10), 'dayMonth'), nurse: followup.nurseName })}
        </Text>
      </View>

      {phone ? <CallButton label={c('callHospital')} number={phone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: dashboardColors.bg,
    borderCurve: 'continuous',
    borderRadius: 18,
    gap: 8,
    padding: 14,
  },
  blockTitle: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  bullet: {
    backgroundColor: dashboardColors.primary,
    borderRadius: 4,
    height: 8,
    marginTop: 9,
    width: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
  },
  date: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 32,
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  doctor: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 17,
    lineHeight: 23,
  },
  emptyCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  flex: { flex: 1 },
  hospitalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  note: {
    backgroundColor: dashboardColors.warningTint,
    borderCurve: 'continuous',
    borderRadius: 18,
    gap: 4,
    padding: 14,
  },
  noteTitle: {
    color: '#B45309',
    fontFamily: careFonts.bold,
    fontSize: 15,
  },
  nurseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  placeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  whenPill: {
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  whenPillSoon: {
    backgroundColor: dashboardColors.primary,
  },
  whenText: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 15,
  },
  whenTextSoon: {
    color: '#FFFFFF',
  },
});
