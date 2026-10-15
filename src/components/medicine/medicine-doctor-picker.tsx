import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { fetchMedicineDoctors, type MedicineDoctor } from '../../lib/medicineDoctors';
import { DoctorAvatar } from '../DoctorAvatar';
import { PressableScale } from '../PressableScale';

const DHRUVA_DOCTORS: MedicineDoctor[] = [
  { display_name: 'Dr. Mounika', id: 'dhruva-mounika' },
  { display_name: 'Dr. Sudarshan Reddy', id: 'dhruva-sudarshan' },
];

function isDhruvaHospital(name: string): boolean {
  return /\bdhruva\b/i.test(name);
}

export function MedicineDoctorPicker({
  hospitalId,
  hospitalName,
  onChange,
  value,
}: {
  hospitalId?: string;
  hospitalName: string;
  onChange: (doctorName: string) => void;
  value: string;
}) {
  const [doctors, setDoctors] = useState<MedicineDoctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDoctors([]);
    setError('');

    if (!hospitalId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchMedicineDoctors(hospitalId)
      .then((items) => {
        if (!cancelled) {
          setDoctors(items.length > 0 || !isDhruvaHospital(hospitalName) ? items : DHRUVA_DOCTORS);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDoctors(isDhruvaHospital(hospitalName) ? DHRUVA_DOCTORS : []);
          setError(
            isDhruvaHospital(hospitalName)
              ? 'Showing Dhruva doctors while the hospital list syncs.'
              : 'Unable to load doctors for this hospital.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hospitalId]);

  if (!hospitalId) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.icon}>
            <Ionicons
              color={dashboardColors.primary}
              name="person-outline"
              size={20}
            />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>Prescribed by</Text>
            <Text style={styles.subtitle}>
              Add a doctor name for {hospitalName || 'this hospital'} if you
              want it on the reminder.
            </Text>
          </View>
        </View>
        <Text style={styles.optional}>Doctor selection is optional.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons
            color={dashboardColors.primary}
            name="person-outline"
            size={20}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Prescribed by</Text>
          <Text style={styles.subtitle}>
            Select a doctor from {hospitalName || 'this hospital'}.
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator
          color={dashboardColors.primary}
          style={styles.loading}
        />
      ) : doctors.length === 0 ? (
        <Text style={styles.optional}>No doctors are listed for this hospital.</Text>
      ) : (
        <View style={styles.options}>
          {doctors.map((doctor) => {
            const selected = doctor.display_name === value;
            return (
              <PressableScale
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={doctor.id}
                onPress={() => onChange(selected ? '' : doctor.display_name)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <DoctorAvatar doctorName={doctor.display_name} roundedSquare size={34} />
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {doctor.display_name}
                </Text>
                <Ionicons
                  color={
                    selected
                      ? dashboardColors.primary
                      : dashboardColors.textFaint
                  }
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                />
              </PressableScale>
            );
          })}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {value ? (
        <PressableScale
          accessibilityLabel="Clear selected doctor"
          onPress={() => onChange('')}
          style={styles.clear}
        >
          <Text style={styles.clearText}>Clear doctor</Text>
        </PressableScale>
      ) : null}
      <Text style={styles.optional}>Doctor selection is optional.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    padding: dashboardSpacing.gap,
  },
  clear: {
    alignSelf: 'flex-start',
    marginTop: dashboardSpacing.sm,
    paddingVertical: dashboardSpacing.xs,
  },
  clearText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
  },
  copy: {
    flex: 1,
  },
  error: {
    ...dashboardTypography.caption,
    color: dashboardColors.error,
    marginTop: dashboardSpacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  loading: {
    marginVertical: dashboardSpacing.gap,
  },
  optional: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.md,
  },
  option: {
    alignItems: 'center',
    gap: dashboardSpacing.md,
    borderColor: dashboardColors.track,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: dashboardSpacing.sm,
    minHeight: 48,
    paddingHorizontal: dashboardSpacing.md,
  },
  optionSelected: {
    backgroundColor: dashboardColors.primaryTint,
    borderColor: dashboardColors.primary,
  },
  optionText: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    flex: 1,
  },
  optionTextSelected: {
    color: dashboardColors.primaryDark,
  },
  options: {
    marginTop: dashboardSpacing.md,
  },
  subtitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
  title: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
  },
});
