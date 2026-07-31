import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PlayerPhase } from '../mobile/use-player-runtime';

interface StatusScreenProps {
  phase: PlayerPhase;
  message: string;
  onAdminRequest: () => void;
}

export function StatusScreen({ phase, message, onAdminRequest }: StatusScreenProps) {
  const loading = phase === 'booting' || phase === 'connecting' || phase === 'syncing';

  return (
    <Pressable
      delayLongPress={1_500}
      focusable
      hasTVPreferredFocus
      onLongPress={onAdminRequest}
      style={styles.screen}
    >
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>A</Text>
      </View>
      <Text style={styles.title}>AquaTV</Text>
      {loading ? <ActivityIndicator color="#4ade80" size="large" style={styles.spinner} /> : null}
      <Text style={styles.message}>{message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#020b08',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#4ade80',
    borderRadius: 20,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  brandMarkText: {
    color: '#052e16',
    fontSize: 40,
    fontWeight: '900',
  },
  title: {
    color: '#f0fdf4',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 18,
  },
  spinner: {
    marginTop: 22,
  },
  message: {
    color: '#86a995',
    fontSize: 18,
    marginTop: 18,
    textAlign: 'center',
  },
});
