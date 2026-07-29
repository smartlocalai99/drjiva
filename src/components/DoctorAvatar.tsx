import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const DOCTOR_PLACEHOLDER = require('../../assets/branding/doctor-placeholder.jpg');

export function DoctorAvatar({ size = 20 }: { size?: number }) {
  return (
    <View
      style={[styles.wrap, { borderRadius: size / 2, height: size, width: size }]}
    >
      <Image contentFit="cover" source={DOCTOR_PLACEHOLDER} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
