import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';

export function CustomMedicineSheet({
  busy,
  onClose,
  onCreate,
  visible,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { imageUri: string; name: string }) => void;
  visible: boolean;
}) {
  const [imageUri, setImageUri] = useState('');
  const [name, setName] = useState('');
  useEffect(() => {
    if (!visible) {
      setImageUri('');
      setName('');
    }
  }, [visible]);

  const choose = async (camera: boolean) => {
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera permission needed', 'Allow camera access to photograph the tablet.');
        return;
      }
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 });
    if (!result.canceled && result.assets[0]?.uri) setImageUri(result.assets[0].uri);
  };

  const valid = name.trim().length >= 2 && Boolean(imageUri);
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <Pressable onPress={busy ? undefined : onClose} style={styles.backdrop}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
          <View style={styles.header}>
            <View><Text style={styles.eyebrow}>YOUR TABLET</Text><Text style={styles.title}>Add new tablet</Text></View>
            <PressableScale disabled={busy} onPress={onClose} style={styles.close}><Ionicons color={dashboardColors.textMuted} name="close" size={22} /></PressableScale>
          </View>
          <View style={styles.photoWrap}>
            {imageUri ? <Image contentFit="contain" source={{ uri: imageUri }} style={styles.photo} /> : <Ionicons color={dashboardColors.textFaint} name="medical-outline" size={42} />}
          </View>
          <View style={styles.photoActions}>
            <PressableScale disabled={busy} onPress={() => void choose(true)} style={styles.photoButton}><Ionicons color={dashboardColors.primary} name="camera-outline" size={20} /><Text style={styles.photoButtonText}>Take photo</Text></PressableScale>
            <PressableScale disabled={busy} onPress={() => void choose(false)} style={styles.photoButton}><Ionicons color={dashboardColors.primary} name="images-outline" size={20} /><Text style={styles.photoButtonText}>Choose photo</Text></PressableScale>
          </View>
          <Text style={styles.label}>Tablet name</Text>
          <TextInput autoCapitalize="words" editable={!busy} onChangeText={setName} placeholder="Example: Dolo 650" placeholderTextColor={dashboardColors.textFaint} style={styles.input} value={name} />
          <PressableScale disabled={!valid || busy} onPress={() => onCreate({ imageUri, name })} style={[styles.create, (!valid || busy) && styles.createDisabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.createText}>Save tablet</Text><Ionicons color="#FFFFFF" name="checkmark" size={20} /></>}
          </PressableScale>
          <Text style={styles.privacy}>Only your account can view this tablet and photo.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(15,23,42,0.5)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: dashboardColors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: dashboardSpacing.pagePadding, paddingBottom: 32 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { ...dashboardTypography.caption, color: dashboardColors.primary },
  title: { ...dashboardTypography.title, color: dashboardColors.text, marginTop: 2 },
  close: { alignItems: 'center', backgroundColor: dashboardColors.bg, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  photoWrap: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#E8E8E8', borderRadius: 24, height: 150, justifyContent: 'center', marginTop: 20, overflow: 'hidden', width: 210 },
  photo: { backgroundColor: '#E8E8E8', height: '100%', width: '100%' },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  photoButton: { alignItems: 'center', backgroundColor: dashboardColors.primaryTint, borderRadius: dashboardRadii.pill, flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 12 },
  photoButtonText: { ...dashboardTypography.body, color: dashboardColors.primary },
  label: { ...dashboardTypography.body, color: dashboardColors.text, marginBottom: 7, marginTop: 18 },
  input: { ...dashboardTypography.body, backgroundColor: dashboardColors.bg, borderColor: dashboardColors.track, borderRadius: 18, borderWidth: 1, color: dashboardColors.text, height: 56, paddingHorizontal: 16 },
  create: { alignItems: 'center', backgroundColor: dashboardColors.primary, borderRadius: dashboardRadii.button, flexDirection: 'row', gap: 7, height: 54, justifyContent: 'center', marginTop: 18 },
  createDisabled: { opacity: 0.45 },
  createText: { ...dashboardTypography.button, color: '#FFFFFF' },
  privacy: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginTop: 10, textAlign: 'center' },
});
