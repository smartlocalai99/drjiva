import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const DEFAULT_PROFILE_IMAGE = require('../../assets/userprofile.png');

type ProfileAvatarFallbackProps = {
  size?: number;
};

export function ProfileAvatarFallback({
  size = 40,
}: ProfileAvatarFallbackProps) {
  const fittedImageSize = Math.round(size * 0.76);

  return (
    <View
      style={[
        styles.container,
        { borderRadius: size / 2, height: size, width: size },
      ]}
    >
      <Image
        accessibilityLabel="Default profile picture"
        contentFit="contain"
        source={DEFAULT_PROFILE_IMAGE}
        style={{ height: fittedImageSize, width: fittedImageSize }}
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
