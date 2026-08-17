import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const DOCTOR_PLACEHOLDER = require('../../assets/branding/doctor-placeholder.jpg');

// One entry per doctor with a real photo on file. Key is the doctor's name
// normalized (lowercase, trimmed) — matched against the billed doctor_name
// by substring so "Dr. Sudarshan" and "sudarshan" both hit the same entry.
// Add a line here + drop the file in assets/doctors/ as each doctor's photo
// becomes available; anything not listed falls back to DOCTOR_PLACEHOLDER.
const DOCTOR_PHOTOS: Record<string, ReturnType<typeof require>> = {
  mounika: require('../../assets/doctors/mounika.jpeg'),
  sudarshan: require('../../assets/doctors/sudarshan.jpeg'),
};

function resolveDoctorPhoto(doctorName?: string | null) {
  const normalized = (doctorName ?? '').trim().toLocaleLowerCase();
  for (const [key, photo] of Object.entries(DOCTOR_PHOTOS)) {
    if (normalized.includes(key)) return photo;
  }
  return DOCTOR_PLACEHOLDER;
}

export function DoctorAvatar({
  doctorName,
  roundedSquare = false,
  size = 20,
}: {
  doctorName?: string | null;
  roundedSquare?: boolean;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.wrap,
        {
          borderRadius: roundedSquare ? Math.max(10, size * 0.2) : size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <Image
        cachePolicy="memory"
        contentFit="cover"
        source={resolveDoctorPhoto(doctorName)}
        style={styles.image}
      />
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
  image: {
    height: '100%',
    width: '100%',
  },
});
