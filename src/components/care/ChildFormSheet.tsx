import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { addChild, ChildCareError, updateChild, type ChildInput } from '../../lib/careChild';
import { useCareCopy } from '../../lib/careCopy';
import type { CarePlan } from '../../lib/careSchedule';
import { UNNAMED_CHILD } from '../../lib/childGrowth';
import { PressableScale } from '../PressableScale';
import { CareDateField } from './CareDateField';
import { CareSheet } from './CareSheet';
import { careFonts } from './careStyles';

// Add a child, or change the name, gender or date of birth (every vaccine
// date is worked out again from it).
export function ChildFormSheet({
  child,
  onClose,
  onSaved,
  phone,
  subtitle,
  today,
  visible,
}: {
  child: CarePlan | null;
  onClose: () => void;
  onSaved: (plan: CarePlan) => void;
  phone: string;
  subtitle: string | null;
  today: string;
  visible: boolean;
}) {
  return visible ? (
    <ChildForm child={child} key={child?.id ?? 'new'} onClose={onClose} onSaved={onSaved} phone={phone} subtitle={subtitle} today={today} />
  ) : null;
}

function ChildForm({
  child,
  onClose,
  onSaved,
  phone,
  subtitle,
  today,
}: {
  child: CarePlan | null;
  onClose: () => void;
  onSaved: (plan: CarePlan) => void;
  phone: string;
  subtitle: string | null;
  today: string;
}) {
  const { c } = useCareCopy();
  // No name yet is fine: saved as "Child".
  const [name, setName] = useState(child && child.personName !== UNNAMED_CHILD ? child.personName : '');
  const [gender, setGender] = useState<ChildInput['gender'] | null>(child?.gender ?? null);
  const [birthDate, setBirthDate] = useState<string | null>(child?.birthDate ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const oldest = `${y - 18}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const save = async () => {
    if (!gender) return setError(c('childErrGender'));
    if (!birthDate) return setError(c('childErrBirthDate'));
    setBusy(true);
    setError(null);
    try {
      const input = { birthDate, gender, name: name.trim() || UNNAMED_CHILD };
      onSaved(child ? await updateChild(phone, child.id, input) : await addChild(phone, input));
      onClose();
    } catch (saveError) {
      setError(c(saveError instanceof ChildCareError ? saveError.copyKey : 'childErrSave'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CareSheet
      footer={
        <>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[styles.save, busy && styles.busy]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{c(child ? 'childSave' : 'childAddButton')}</Text>}
          </PressableScale>
        </>
      }
      onClose={onClose}
      subtitle={subtitle}
      title={c(child ? 'childEditTitle' : 'childAddTitle')}
      visible
    >
      <View style={styles.group}>
        <Text style={styles.label}>{c('childName')}</Text>
        <TextInput
          accessibilityHint={c('childNameHint')}
          accessibilityLabel={c('childName')}
          autoCapitalize="words"
          maxLength={60}
          onChangeText={setName}
          placeholder={c('childNoName')}
          placeholderTextColor={dashboardColors.textFaint}
          style={styles.input}
          value={name}
        />
        <Text style={styles.note}>{c('childNameHint')}</Text>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{c('childGender')}</Text>
        <View style={styles.pair}>
          {(['female', 'male'] as const).map((value) => (
            <PressableScale
              accessibilityRole="radio"
              accessibilityState={{ checked: gender === value }}
              key={value}
              onPress={() => setGender(value)}
              style={[styles.choice, gender === value && styles.choiceOn]}
            >
              <Text style={[styles.choiceText, gender === value && styles.choiceTextOn]}>{c(value === 'female' ? 'childGirl' : 'childBoy')}</Text>
            </PressableScale>
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <CareDateField label={c('childDob')} max={today} min={oldest} onChange={setBirthDate} value={birthDate} />
        <Text style={styles.note}>{c('childDobNote')}</Text>
      </View>

    </CareSheet>
  );
}

const styles = StyleSheet.create({
  busy: {
    opacity: 0.6,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1.5,
    flex: 1,
    paddingVertical: 14,
  },
  choiceOn: {
    backgroundColor: dashboardColors.primary,
    borderColor: dashboardColors.primary,
  },
  choiceText: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 17,
  },
  choiceTextOn: {
    color: '#FFFFFF',
  },
  error: {
    color: '#B91C1C',
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
  },
  group: {
    gap: 8,
  },
  input: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1.5,
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  label: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  note: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  pair: {
    flexDirection: 'row',
    gap: 10,
  },
  save: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderCurve: 'continuous',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 54,
  },
  saveText: {
    color: '#FFFFFF',
    fontFamily: careFonts.bold,
    fontSize: 17,
  },
});
