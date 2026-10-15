import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../dashboardTheme';
import {
  getIdentityInitials,
  resolveHospitalBrand,
  type HospitalBrand,
} from '../lib/brandIdentity';

const ASIAN_LOGO = require('../../assets/branding/hospital-logo.png');
export const DHRUVA_LOGO = require('../../assets/dhruvalogo.png');

const HOSPITAL_LOGOS: Record<HospitalBrand, ReturnType<typeof require>> = {
  asian: ASIAN_LOGO,
  dhruva: DHRUVA_LOGO,
};

export function isDhruvaHospital(hospitalName?: string): boolean {
  return resolveHospitalBrand(hospitalName) === 'dhruva';
}

export function HospitalLogo({
  hospitalName,
  logoUrl,
  roundedSquare = false,
  size = 28,
}: {
  hospitalName?: string;
  logoUrl?: string | null;
  roundedSquare?: boolean;
  size?: number;
}) {
  const brand = resolveHospitalBrand(hospitalName);
  const remoteLogoUrl = logoUrl?.trim() || null;
  const logoSource = remoteLogoUrl
    ? { uri: remoteLogoUrl }
    : brand
      ? HOSPITAL_LOGOS[brand]
      : null;
  const [logoFailed, setLogoFailed] = useState(false);
  const sourceKey = remoteLogoUrl ?? brand ?? '';
  const showLogo = logoSource !== null && !logoFailed;

  useEffect(() => {
    setLogoFailed(false);
  }, [sourceKey]);

  return (
    <View
      accessibilityLabel={`${hospitalName?.trim() || 'Hospital'} logo`}
      accessible
      style={[
        styles.wrap,
        brand === 'dhruva' && styles.dhruvaWrap,
        !showLogo && styles.fallbackWrap,
        {
          borderRadius: roundedSquare ? Math.max(10, size * 0.22) : size / 2,
          height: size,
          padding: showLogo ? (brand === 'dhruva' ? size * 0.06 : size * 0.12) : 0,
          width: size,
        },
      ]}
    >
      {showLogo ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          onError={() => setLogoFailed(true)}
          source={logoSource}
          style={styles.image}
        />
      ) : (
        <Text
          style={[styles.fallbackText, { fontSize: Math.max(10, size * 0.32) }]}
        >
          {getIdentityInitials(hospitalName, 'H')}
        </Text>
      )}
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
  fallbackText: {
    color: dashboardColors.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  fallbackWrap: {
    backgroundColor: '#EAF5F7',
  },
  dhruvaWrap: {
    borderColor: '#2467A6',
  },
});
