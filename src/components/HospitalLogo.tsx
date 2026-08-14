import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { dashboardColors } from '../dashboardTheme';

const HOSPITAL_LOGO = require('../../assets/branding/hospital-logo.png');
export const DHRUVA_LOGO = require('../../assets/dhruvalogo.png');

export function isDhruvaHospital(hospitalName?: string): boolean {
  return (hospitalName ?? '').trim().toLocaleLowerCase().includes('dhruva');
}

export function HospitalLogo({
  hospitalName,
  roundedSquare = false,
  size = 28,
}: {
  hospitalName?: string;
  roundedSquare?: boolean;
  size?: number;
}) {
  const useDhruvaLogo = isDhruvaHospital(hospitalName);

  return (
    <View
      style={[
        styles.wrap,
        useDhruvaLogo && styles.dhruvaWrap,
        {
          borderRadius: roundedSquare ? Math.max(10, size * 0.22) : size / 2,
          height: size,
          padding: useDhruvaLogo ? size * 0.06 : size * 0.12,
          width: size,
        },
      ]}
    >
      <Image
        cachePolicy="memory"
        contentFit="contain"
        source={useDhruvaLogo ? DHRUVA_LOGO : HOSPITAL_LOGO}
        style={styles.image}
      />
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
  dhruvaWrap: {
    borderColor: '#2467A6',
  },
});
