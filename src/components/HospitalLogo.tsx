import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { dashboardColors } from '../dashboardTheme';

const HOSPITAL_LOGO = require('../../assets/branding/hospital-logo.png');

export function HospitalLogo({
  roundedSquare = false,
  size = 28,
}: {
  roundedSquare?: boolean;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.wrap,
        {
          borderRadius: roundedSquare ? Math.max(10, size * 0.22) : size / 2,
          height: size,
          padding: size * 0.12,
          width: size,
        },
      ]}
    >
      <Image
        cachePolicy="memory"
        contentFit="contain"
        source={HOSPITAL_LOGO}
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
});
