import { Inter_500Medium } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import {
  Newsreader_300Light,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium
} from '@expo-google-fonts/newsreader';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LockScreen } from '@/components/LockScreen';
import { AppLockProvider } from '@/lib/appLock';
import { SessionProvider } from '@/lib/session';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { colors, scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        {/* Care screens sit outside the session gate in (tabs): they must open
            even when the account could not be reached. */}
        <Stack.Screen name="calm" options={{ presentation: 'modal' }} />
        <Stack.Screen name="help" options={{ presentation: 'modal' }} />
        {/* Full screen and no swipe-to-dismiss, so it can't be flicked away
            by accident; its own buttons always close it. */}
        <Stack.Screen name="crisis" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
      <LockScreen />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_300Light,
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Inter_500Medium,
    JetBrainsMono_400Regular
  });

  // A font that fails to load falls back to the system face; that is better
  // than an app that never gets past the splash screen.
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <AppLockProvider>
              <Navigator />
            </AppLockProvider>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
