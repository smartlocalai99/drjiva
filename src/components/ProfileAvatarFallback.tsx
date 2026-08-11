import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const DEFAULT_PROFILE_IMAGE = require('../../assets/userprofile.png');

type ProfileAvatarFallbackProps = {
  size?: number;
};

export function ProfileAvatarFallback({
  size = 40,
}: ProfileAvatarFallbackProps) {
  return (
    <View
      style={[
        styles.container,
        { borderRadius: size / 2, height: size, width: size },
      ]}
    >
      <Image
        accessibilityLabel="Default profile picture"
        contentFit="cover"
        source={DEFAULT_PROFILE_IMAGE}
        style={{ height: size, width: size }}
        transition={120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
