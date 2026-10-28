import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { getIdentityInitials, resolveDoctorIdentity, type DoctorIdentity } from '../../lib/brandIdentity';
import { careFonts } from './careStyles';

// Same doctors and photos as DoctorAvatar, shown as a rectangle with
// slightly rounded corners (next-visit card).
const PHOTOS: Record<DoctorIdentity, number> = {
  'chaitanya-reddy': require('../../../assets/shankargastroenterologists.png'),
  mounika: require('../../../assets/doctors/mounikaupdted.jpeg'),
  'ritish-reddy': require('../../../assets/doctors/Rithesh.jpg'),
  sudarshan: require('../../../assets/doctors/sudarshan.jpeg'),
};

export function DoctorPhoto({
  doctorName,
  height,
  hospitalName,
  width,
}: {
  doctorName: string;
  height: number;
  hospitalName: string;
  width: number;
}) {
  const identity = resolveDoctorIdentity(doctorName, hospitalName);
  const [failed, setFailed] = useState(false);
  const source = identity ? PHOTOS[identity] : null;

  return (
    <View accessibilityLabel={`${doctorName} photo`} accessible style={[styles.frame, { height, width }]}>
      {source && !failed ? (
        <Image contentFit="cover" contentPosition="top" onError={() => setFailed(true)} source={source} style={styles.image} />
      ) : (
        <Text style={styles.initials}>{getIdentityInitials(doctorName, 'DR')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderCurve: 'continuous',
    borderRadius: 14,
    boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  initials: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 26,
  },
});
