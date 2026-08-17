import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { dashboardColors } from '../dashboardTheme';

const HOSPITAL_LOGO = require('../../assets/branding/hospital-logo.png');
export const DHRUVA_LOGO = require('../../assets/dhruvalogo.png');

// One entry per hospital with a real logo on file. Key is the hospital name
// normalized (lowercase, trimmed) — matched against the DB's `hospitals.name`
// by substring so "Dhruva Hospitals" and "dhruva" both hit the same entry.
// Add a line here + drop the file in assets/hospitals/ as each hospital's
// logo becomes available; anything not listed falls back to HOSPITAL_LOGO.
const HOSPITAL_LOGOS: Record<string, ReturnType<typeof require>> = {
  dhruva: DHRUVA_LOGO,
};

export function isDhruvaHospital(hospitalName?: string): boolean {
  return (hospitalName ?? '').trim().toLocaleLowerCase().includes('dhruva');
}

function resolveHospitalLogo(hospitalName?: string) {
  const normalized = (hospitalName ?? '').trim().toLocaleLowerCase();
  for (const [key, logo] of Object.entries(HOSPITAL_LOGOS)) {
    if (normalized.includes(key)) return logo;
  }
  return HOSPITAL_LOGO;
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
        source={resolveHospitalLogo(hospitalName)}
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
