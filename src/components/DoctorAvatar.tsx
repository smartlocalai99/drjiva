import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const DOCTOR_PLACEHOLDER = require('../../assets/branding/doctor-placeholder.jpg');

export function DoctorAvatar({
  roundedSquare = false,
  size = 20,
}: {
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
        source={DOCTOR_PLACEHOLDER}
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
