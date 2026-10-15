import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  getIdentityInitials,
  resolveDoctorIdentity,
  type DoctorIdentity,
} from '../lib/brandIdentity';

const DOCTOR_PHOTOS: Record<DoctorIdentity, ReturnType<typeof require>> = {
  'chaitanya-reddy': require('../../assets/shankargastroenterologists.png'),
  mounika: require('../../assets/doctors/mounika.jpeg'),
  'ritish-reddy': require('../../assets/doctors/Rithesh.jpg'),
  sudarshan: require('../../assets/doctors/sudarshan.jpeg'),
};

export function DoctorAvatar({
  doctorName,
  hospitalName,
  photoUrl,
  roundedSquare = false,
  size = 20,
}: {
  doctorName?: string | null;
  hospitalName?: string | null;
  photoUrl?: string | null;
  roundedSquare?: boolean;
  size?: number;
}) {
  const identity = resolveDoctorIdentity(doctorName, hospitalName);
  const fallbackDoctorName =
    doctorName?.trim().toLocaleLowerCase() === 'care team' ? null : doctorName;
  const remotePhotoUrl = photoUrl?.trim() || null;
  const photoSource = remotePhotoUrl
    ? { uri: remotePhotoUrl }
    : identity
      ? DOCTOR_PHOTOS[identity]
      : null;
  const [photoFailed, setPhotoFailed] = useState(false);
  const sourceKey = remotePhotoUrl ?? identity ?? '';
  const showPhoto = photoSource !== null && !photoFailed;

  useEffect(() => {
    setPhotoFailed(false);
  }, [sourceKey]);

  return (
    <View
      accessibilityLabel={`${fallbackDoctorName?.trim() || 'Doctor'} profile photo`}
      accessible
      style={[
        styles.wrap,
        !showPhoto && styles.fallbackWrap,
        {
          borderRadius: roundedSquare ? Math.max(10, size * 0.2) : size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      {showPhoto ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          onError={() => setPhotoFailed(true)}
          source={photoSource}
          style={styles.image}
        />
      ) : (
        <Text
          style={[styles.fallbackText, { fontSize: Math.max(9, size * 0.3) }]}
        >
          {getIdentityInitials(fallbackDoctorName, 'DR')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  fallbackText: {
    color: '#246A73',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  fallbackWrap: {
    alignItems: 'center',
    backgroundColor: '#E7F2FA',
    justifyContent: 'center',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
