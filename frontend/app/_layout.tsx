import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import InstallBanner from '../components/InstallBanner';
import {
  useFonts,
  Outfit_900Black,
  Outfit_800ExtraBold,
} from '@expo-google-fonts/outfit';
import {
  DMSans_400Regular,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';

// Cap OS font scaling so user font-size settings can't break fixed layouts.
// @ts-expect-error defaultProps is untyped on RN function components
Text.defaultProps = { ...(Text.defaultProps ?? {}), maxFontSizeMultiplier: 1.2 };
// @ts-expect-error defaultProps is untyped on RN function components
TextInput.defaultProps = { ...(TextInput.defaultProps ?? {}), maxFontSizeMultiplier: 1.2 };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_900Black,
    Outfit_800ExtraBold,
    DMSans_400Regular,
    DMSans_600SemiBold,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      if (__DEV__) {
        // A cache-first service worker makes localhost appear to ignore fresh
        // code. Remove old registrations while developing.
        void navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations.map((entry) => entry.unregister())))
          .catch(() => {});
      } else {
        void navigator.serviceWorker.register('/sw.js');
      }
    }
  }, []);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" options={{ gestureEnabled: false }} />
        <Stack.Screen name="how-to-play" />
        <Stack.Screen name="game-modes" />
        <Stack.Screen name="game-modes/[modeKey]" />
      </Stack>
      <InstallBanner />
    </>
  );
}
