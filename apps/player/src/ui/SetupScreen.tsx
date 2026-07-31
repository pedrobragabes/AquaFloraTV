import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { TvButton } from './TvButton';

interface SetupScreenProps {
  initialApiUrl: string;
  connecting: boolean;
  message: string;
  onConnect: (apiUrl: string) => Promise<void>;
}

export function SetupScreen({ initialApiUrl, connecting, message, onConnect }: SetupScreenProps) {
  const [apiUrl, setApiUrl] = useState(initialApiUrl);

  useEffect(() => {
    setApiUrl(initialApiUrl);
  }, [initialApiUrl]);

  const connect = (): void => {
    if (!connecting) {
      void onConnect(apiUrl);
    }
  };

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>A</Text>
          </View>
          <View>
            <Text style={styles.eyebrow}>AQUAFLORA GROW SHOP</Text>
            <Text style={styles.title}>AquaTV</Text>
          </View>
        </View>

        <Text style={styles.description}>
          Conecte esta TV ao computador da loja. O cadastro do aparelho sera automatico.
        </Text>

        <Text style={styles.label}>Endereco da API</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!connecting}
          keyboardType="url"
          onChangeText={setApiUrl}
          onSubmitEditing={connect}
          placeholder="192.168.1.10:7741"
          placeholderTextColor="#648274"
          returnKeyType="done"
          selectionColor="#4ade80"
          style={styles.input}
          value={apiUrl}
        />

        <TvButton
          disabled={connecting}
          hasTVPreferredFocus
          label={connecting ? 'Conectando...' : 'Conectar TV'}
          onPress={connect}
          style={styles.connectButton}
        />

        <View style={styles.statusRow}>
          {connecting ? <ActivityIndicator color="#4ade80" size="small" /> : null}
          <Text style={styles.status}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#020b08',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 32,
  },
  glowTop: {
    backgroundColor: '#14532d',
    borderRadius: 260,
    height: 520,
    opacity: 0.32,
    position: 'absolute',
    right: -160,
    top: -220,
    width: 520,
  },
  glowBottom: {
    backgroundColor: '#0c4a6e',
    borderRadius: 220,
    bottom: -240,
    height: 440,
    left: -120,
    opacity: 0.22,
    position: 'absolute',
    width: 440,
  },
  card: {
    backgroundColor: '#07150f',
    borderColor: '#1d3a2c',
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 680,
    padding: 36,
    width: '100%',
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#4ade80',
    borderRadius: 18,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  brandMarkText: {
    color: '#052e16',
    fontSize: 36,
    fontWeight: '900',
  },
  eyebrow: {
    color: '#86efac',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    color: '#f0fdf4',
    fontSize: 38,
    fontWeight: '800',
  },
  description: {
    color: '#a7c7b4',
    fontSize: 18,
    lineHeight: 27,
    marginBottom: 28,
    marginTop: 26,
  },
  label: {
    color: '#bbf7d0',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#020b08',
    borderColor: '#315844',
    borderRadius: 12,
    borderWidth: 2,
    color: '#f0fdf4',
    fontSize: 20,
    minHeight: 58,
    paddingHorizontal: 18,
  },
  connectButton: {
    marginTop: 18,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 24,
    marginTop: 18,
  },
  status: {
    color: '#86a995',
    flex: 1,
    fontSize: 15,
  },
});
