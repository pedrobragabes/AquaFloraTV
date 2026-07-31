import { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';

import { normalizeApiUrl } from './src/api-url';
import { usePlayerRuntime } from './src/mobile/use-player-runtime';
import { AdminOverlay } from './src/ui/AdminOverlay';
import { PlaybackScreen } from './src/ui/PlaybackScreen';
import { SetupScreen } from './src/ui/SetupScreen';
import { StatusScreen } from './src/ui/StatusScreen';

function getDefaultApiUrl(): string {
  const configured = Constants.expoConfig?.extra?.apiUrl;
  if (typeof configured !== 'string') {
    return '';
  }
  return normalizeApiUrl(configured) ?? configured;
}

export default function App() {
  const runtime = usePlayerRuntime(getDefaultApiUrl());

  useEffect(() => {
    void activateKeepAwakeAsync('aquatv-player');
    return () => {
      void deactivateKeepAwake('aquatv-player');
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (runtime.adminVisible) {
        runtime.closeAdmin();
      }
      return true;
    });
    return () => subscription.remove();
  }, [runtime.adminVisible, runtime.closeAdmin]);

  useEffect(() => {
    if (!runtime.currentItem || runtime.currentMediaUri) {
      return undefined;
    }

    const timer = setTimeout(
      () => runtime.handlePlaybackError(`Cache ausente: ${runtime.currentItem?.media.storedName}`),
      1_500,
    );
    return () => clearTimeout(timer);
  }, [runtime.currentItem, runtime.currentMediaUri, runtime.handlePlaybackError]);

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {runtime.adminVisible && runtime.settings ? (
        <View style={styles.adminBackground} />
      ) : !runtime.settings ? (
        <SetupScreen
          connecting={runtime.phase === 'connecting'}
          initialApiUrl={runtime.setupApiUrl}
          message={runtime.message}
          onConnect={runtime.connect}
        />
      ) : runtime.currentItem && runtime.currentMediaUri ? (
        <PlaybackScreen
          key={runtime.playbackKey}
          item={runtime.currentItem}
          mediaUri={runtime.currentMediaUri}
          onAdminRequest={runtime.openAdmin}
          onAdvance={runtime.advance}
          onError={runtime.handlePlaybackError}
        />
      ) : (
        <StatusScreen
          message={runtime.message}
          onAdminRequest={runtime.openAdmin}
          phase={runtime.phase}
        />
      )}

      {runtime.adminVisible && runtime.settings ? (
        <AdminOverlay
          cacheProgress={runtime.cacheProgress}
          lastPlaybackError={runtime.lastPlaybackError}
          lastSyncAt={runtime.lastSyncAt}
          message={runtime.message}
          onClose={runtime.closeAdmin}
          onResetConnection={runtime.resetConnection}
          onSync={runtime.syncNow}
          phase={runtime.phase}
          settings={runtime.settings}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#000000',
    flex: 1,
  },
  adminBackground: {
    backgroundColor: '#020b08',
    flex: 1,
  },
});
