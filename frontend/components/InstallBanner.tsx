import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, FONTS } from '../utils/theme';

// Fired by Chrome/Edge once install criteria (manifest + HTTPS + service worker) are met.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || !deferredPrompt || installed || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Install Judgement for a smoother game</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => setDismissed(true)} style={styles.dismissButton}>
          <Text style={styles.dismissText}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleInstall} style={styles.installButton}>
          <Text style={styles.installText}>Install</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSolid,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGlass,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  text: {
    flex: 1,
    color: COLORS.text,
    fontFamily: FONTS.body,
    fontSize: 14,
    marginRight: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dismissText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
  installButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  installText: {
    color: COLORS.background,
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
});
