import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_900Black,
    Outfit_800ExtraBold,
    DMSans_400Regular,
    DMSans_600SemiBold,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game" />
      </Stack>
    </>
  );
}
