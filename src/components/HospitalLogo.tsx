import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { dashboardColors } from '../dashboardTheme';

const HOSPITAL_LOGO = require('../../assets/branding/hospital-logo.png');

export function HospitalLogo({ size = 28 }: { size?: number }) {
  return (
    <View
      style={[
        styles.wrap,
        { borderRadius: size / 2, height: size, padding: size * 0.16, width: size },
      ]}
    >
      <Image contentFit="contain" source={HOSPITAL_LOGO} style={styles.image} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: dashboardColors.primary,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
});
