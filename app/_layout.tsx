import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { NotoSansTelugu_400Regular } from '@expo-google-fonts/noto-sans-telugu/400Regular';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { SplashTransitionProvider } from '../src/components/SplashTransition';
import { CartProvider } from '../src/lib/cart';
import { loadExpoNotifications } from '../src/lib/expoNotifications';
import { LanguageProvider } from '../src/lib/i18n';
import { replenishOngoingMedicineCourses } from '../src/lib/ongoingMedicineCoordinator';
import { colors } from '../src/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 0, fade: false });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    NotoSansTelugu_400Regular,
  });

  useEffect(() => {
    const clearBadge = () => {
      void loadExpoNotifications()
        .then((Notifications) => {
          Notifications?.setNotificationHandler({
            handleNotification: async () => ({
              shouldPlaySound: true,
              shouldSetBadge: true,
              shouldShowBanner: true,
              shouldShowList: true,
            }),
          });
          return Notifications?.setBadgeCountAsync(0);
        })
        .catch(() => undefined);
    };

    clearBadge();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearBadge();
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const replenish = () => {
      void replenishOngoingMedicineCourses().catch((error) =>
        console.warn('Unable to extend ongoing medicine reminders', error),
      );
    };
    replenish();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') replenish();
    });
    return () => subscription.remove();
  }, []);

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <CartProvider>
        <SplashTransitionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              animation: 'fade',
              contentStyle: { backgroundColor: colors.bg },
              headerShown: false,
            }}
          >
            <Stack.Screen
              name="shop-address"
              options={{
                contentStyle: { backgroundColor: colors.bg },
                presentation: 'formSheet',
                sheetAllowedDetents: [0.55, 0.9],
                sheetCornerRadius: 28,
                sheetGrabberVisible: true,
                sheetInitialDetentIndex: 0,
              }}
            />
            <Stack.Screen
              name="address-editor"
              options={{
                contentStyle: { backgroundColor: colors.bg },
                presentation: 'formSheet',
                sheetAllowedDetents: [0.94, 1],
                sheetCornerRadius: 28,
                sheetGrabberVisible: true,
                sheetInitialDetentIndex: 0,
              }}
            />
          </Stack>
        </SplashTransitionProvider>
      </CartProvider>
    </LanguageProvider>
  );
}
