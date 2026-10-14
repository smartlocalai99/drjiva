import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import type { CareVaccineRecord, VaccineSite } from '../../lib/care';
import { ChildCareError, clearVaccine, saveVaccine, uploadVaccineLabel, vaccineLabelUrl } from '../../lib/careChild';
import { useCareCopy, type CareCopyKey } from '../../lib/careCopy';
import type { ChildDose } from '../../lib/childGrowth';
import { PressableScale } from '../PressableScale';
import { CareDateField } from './CareDateField';
import { CareSheet } from './CareSheet';
import { careFonts } from './careStyles';

const SITES: readonly [VaccineSite, CareCopyKey][] = [
  ['left_thigh', 'siteLeftThigh'],
  ['right_thigh', 'siteRightThigh'],
  ['left_arm', 'siteLeftArm'],
  ['right_arm', 'siteRightArm'],
  ['oral', 'siteOral'],
  ['other', 'siteOther'],
];

// Record one vaccine from the child's card or the vial: when, where, brand,
// batch, expiry and a photo of the label.
export function VaccineSheet({
  birthDate,
  dose,
  onClose,
  onSaved,
  phone,
  planId,
  today,
}: {
  birthDate: string;
  dose: ChildDose | null;
  onClose: () => void;
  onSaved: (records: CareVaccineRecord[]) => void;
  phone: string;
  planId: string;
  today: string;
}) {
  return dose ? (
    <VaccineForm
      birthDate={birthDate}
      dose={dose}
      key={dose.item.id}
      onClose={onClose}
      onSaved={onSaved}
      phone={phone}
      planId={planId}
      today={today}
    />
  ) : null;
}

function VaccineForm({
  birthDate,
  dose,
  onClose,
  onSaved,
  phone,
  planId,
  today,
}: {
  birthDate: string;
  dose: ChildDose;
  onClose: () => void;
  onSaved: (records: CareVaccineRecord[]) => void;
  phone: string;
  planId: string;
  today: string;
}) {
  const { c, date, pick } = useCareCopy();
  const record = dose.record;
  const [givenOn, setGivenOn] = useState<string | null>(record?.givenOn ?? dose.given?.on ?? today);
  const [site, setSite] = useState<VaccineSite | null>(record?.site ?? null);
  const [brand, setBrand] = useState(record?.brand ?? '');
  const [batchNo, setBatchNo] = useState(record?.batchNo ?? '');
  const [expiry, setExpiry] = useState<string | null>(record?.expiry ?? null);
  const [photoPath, setPhotoPath] = useState<string | null>(record?.photoPath ?? null);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (photoPath && !localPhoto) {
      void vaccineLabelUrl(photoPath).then((url) => {
        if (active) setSavedPhotoUrl(url);
      });
    }
    return () => {
      active = false;
    };
  }, [localPhoto, photoPath]);

  const choose = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(c('vaccinePhoto'), c('childErrPhoto'));
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]?.uri) setLocalPhoto(result.assets[0].uri);
  };

  const save = async () => {
    if (!givenOn) {
      setError(c('childErrGivenOn'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = localPhoto ? await uploadVaccineLabel(planId, dose.item.id, localPhoto) : photoPath;
      const records = await saveVaccine(phone, { batchNo, brand, expiry, givenOn, itemId: dose.item.id, photoPath: path, planId, site });
      onSaved(records);
      onClose();
    } catch (saveError) {
      setError(c(saveError instanceof ChildCareError ? saveError.copyKey : 'childErrSave'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await clearVaccine(phone, planId, dose.item.id));
      onClose();
    } catch {
      setError(c('childErrSave'));
    } finally {
      setBusy(false);
    }
  };

  const photo = localPhoto ?? savedPhotoUrl;

  return (
    <CareSheet
      footer={
        <>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[styles.save, busy && styles.busy]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{c('vaccineSave')}</Text>}
          </PressableScale>
          {record ? (
            <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void clear()} style={styles.clear}>
              <Text style={styles.clearText}>{c('vaccineNotGiven')}</Text>
            </PressableScale>
          ) : null}
        </>
      }
      onClose={onClose}
      subtitle={c('dueOnDate', { date: date(dose.dueDate) })}
      title={pick(dose.item.labelEn, dose.item.labelTe)}
      visible
    >
      {dose.given?.by === 'nurse' && !record ? (
        <View style={styles.nurse}>
          <Ionicons color="#15803D" name="checkmark-circle" size={20} />
          <Text style={styles.nurseText}>
            {c('vaccineByNurse', { date: date(dose.given.on), nurse: dose.item.nurseName ?? '' })}
          </Text>
        </View>
      ) : null}

      <CareDateField label={c('vaccineGivenOn')} max={today} min={birthDate} onChange={setGivenOn} value={givenOn} />

      <View style={styles.group}>
        <Text style={styles.label}>{c('vaccineSite')}</Text>
        <View style={styles.sites}>
          {SITES.map(([value, key]) => (
            <PressableScale
              accessibilityRole="radio"
              accessibilityState={{ checked: site === value }}
              key={value}
              onPress={() => setSite(site === value ? null : value)}
              style={[styles.site, site === value && styles.siteOn]}
            >
              <Text style={[styles.siteText, site === value && styles.siteTextOn]}>{c(key)}</Text>
            </PressableScale>
          ))}
        </View>
      </View>

      <View style={styles.pair}>
        <View style={[styles.group, styles.flex]}>
          <Text style={styles.label}>{c('vaccineBrand')}</Text>
          <TextInput accessibilityLabel={c('vaccineBrand')} maxLength={80} onChangeText={setBrand} style={styles.input} value={brand} />
        </View>
        <View style={[styles.group, styles.flex]}>
          <Text style={styles.label}>{c('vaccineBatch')}</Text>
          <TextInput
            accessibilityLabel={c('vaccineBatch')}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={40}
            onChangeText={setBatchNo}
            style={styles.input}
            value={batchNo}
          />
        </View>
      </View>

      <CareDateField label={c('vaccineExpiry')} onChange={setExpiry} optional value={expiry} />

      <View style={styles.group}>
        <Text style={styles.label}>{c('vaccinePhoto')}</Text>
        {photo ? (
          <View style={styles.photoWrap}>
            <Image contentFit="contain" source={{ uri: photo }} style={styles.photo} />
            <PressableScale
              accessibilityRole="button"
              onPress={() => {
                setLocalPhoto(null);
                setPhotoPath(null);
                setSavedPhotoUrl(null);
              }}
              style={styles.removePhoto}
            >
              <Ionicons color="#B91C1C" name="trash-outline" size={18} />
              <Text style={styles.removeText}>{c('vaccineRemovePhoto')}</Text>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.pair}>
            <PressableScale accessibilityRole="button" onPress={() => void choose(true)} style={styles.photoButton}>
              <Ionicons color={dashboardColors.primary} name="camera-outline" size={22} />
              <Text style={styles.photoButtonText}>{c('vaccineTakePhoto')}</Text>
            </PressableScale>
            <PressableScale accessibilityRole="button" onPress={() => void choose(false)} style={styles.photoButton}>
              <Ionicons color={dashboardColors.primary} name="images-outline" size={22} />
              <Text style={styles.photoButtonText}>{c('vaccineChoosePhoto')}</Text>
            </PressableScale>
          </View>
        )}
      </View>

    </CareSheet>
  );
}

const styles = StyleSheet.create({
  busy: {
    opacity: 0.6,
  },
  clear: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  clearText: {
    color: '#B91C1C',
    fontFamily: careFonts.bold,
    fontSize: 16,
  },
  error: {
    color: '#B91C1C',
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
  },
  flex: { flex: 1 },
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
  nurse: {
    alignItems: 'center',
    backgroundColor: '#E9F9EF',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  nurseText: {
    color: '#15803D',
    flex: 1,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
  },
  pair: {
    flexDirection: 'row',
    gap: 10,
  },
  photo: {
    backgroundColor: dashboardColors.card,
    borderRadius: 16,
    height: 180,
    width: '100%',
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.primaryTint,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1.5,
    flex: 1,
    gap: 4,
    paddingVertical: 14,
  },
  photoButtonText: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 15,
  },
  photoWrap: {
    gap: 8,
  },
  removePhoto: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  removeText: {
    color: '#B91C1C',
    fontFamily: careFonts.semiBold,
    fontSize: 15,
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
  site: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  siteOn: {
    backgroundColor: dashboardColors.primary,
    borderColor: dashboardColors.primary,
  },
  siteText: {
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
  },
  siteTextOn: {
    color: '#FFFFFF',
  },
  sites: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
