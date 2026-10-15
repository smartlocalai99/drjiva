import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import type { CareExtraItem, CareFollowup } from '../../lib/care';
import { useCareCopy } from '../../lib/careCopy';
import { daysUntil, dialableIndianPhone, pendingVisitItems, type CareVisit } from '../../lib/careSchedule';
import { HospitalLogo } from '../HospitalLogo';
import { CallButton } from './CallButton';
import { DoctorPhoto } from './DoctorPhoto';
import { careFonts, careShared } from './careStyles';

// Always the first card: when to go back, where, and who set it.
export function FollowUpCard({
  chips = false,
  extraItems = [],
  followup,
  today,
  visit,
}: {
  /** Show every item as small chips side by side (child vaccines). */
  chips?: boolean;
  extraItems?: CareExtraItem[];
  followup: CareFollowup | null | undefined;
  today: string;
  visit: CareVisit | null;
}) {
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
  const visitItems = visit ? pendingVisitItems(visit) : [];
  // Tests the nurse added from the case sheet for this visit.
  const extras = extraItems.filter((item) => item.dueDate === followup.nextDate && item.hospitalId === followup.hospital.id);

  return (
    <View accessibilityLabel={`${c('nextVisit')}: ${date(followup.nextDate, 'weekdayDayMonth')}, ${when}`} style={careShared.card}>
      <View style={styles.topRow}>
        <Text style={careShared.label}>{c('nextVisit')}</Text>
        <View style={[styles.whenPill, days <= 1 && styles.whenPillSoon]}>
          <Text style={[styles.whenText, days <= 1 && styles.whenTextSoon]}>{when}</Text>
        </View>
      </View>

      {/* Date and doctor on the left, the doctor's photo on the right. */}
      <View style={styles.mainRow}>
        <View style={styles.mainText}>
          <Text style={styles.date}>{date(followup.nextDate, 'weekdayDayMonth')}</Text>
          {followup.doctorName ? <Text style={styles.doctor}>{followup.doctorName}</Text> : null}
          <View style={styles.hospitalRow}>
            <HospitalLogo hospitalName={followup.hospital.name} logoUrl={followup.hospital.logoUrl} roundedSquare size={24} />
            <Text style={[careShared.muted, styles.flex]}>{followup.hospital.name}</Text>
          </View>
        </View>
        {followup.doctorName ? (
          <DoctorPhoto doctorName={followup.doctorName} height={124} hospitalName={followup.hospital.name} width={100} />
        ) : null}
      </View>

      {(visitItems.length > 0 && visit) || extras.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>
            {c('atThisVisit')}
          </Text>
          {chips ? (
            <View style={styles.chips}>
              {[...(visit ? visitItems.map((item) => ({ id: item.id, label: pick(item.labelEn, item.labelTe) })) : []), ...extras].map((item) => (
                <View key={item.id} style={styles.chip}>
                  <Text style={styles.chipText}>{item.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {visit && !chips
            ? visitItems.map((item) => (
                <View key={item.id} style={styles.bulletRow}>
                  <View style={styles.bullet} />
                  <Text style={[careShared.body, styles.flex]}>{pick(item.labelEn, item.labelTe)}</Text>
                </View>
              ))
            : null}
          {(chips ? [] : extras).map((item) => (
            <View key={item.id} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={[careShared.body, styles.flex]}>{item.label}</Text>
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

      {/* Only for a date a nurse saved (a treatment plan's own next step has none). */}
      {followup.nurseName && followup.updatedAt ? (
        <View style={styles.nurseRow}>
          <Ionicons color={dashboardColors.textMuted} name="person-circle-outline" size={20} />
          <Text style={[careShared.muted, styles.flex]}>
            {c('updatedBy', { date: date(followup.updatedAt.slice(0, 10), 'dayMonth'), nurse: followup.nurseName })}
          </Text>
        </View>
      ) : null}

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
  chip: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
  },
  date: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 28,
    letterSpacing: -0.5,
    lineHeight: 34,
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
  mainRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  mainText: {
    flex: 1,
    gap: 6,
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
