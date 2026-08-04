import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import brandLogo from '../../assets/brand/aquaflora-logo.webp';
import { TvButton } from './TvButton';
import {
  displayRotationLabel,
  nextDisplayRotation,
  type DisplayRotation,
} from '../mobile/display-orientation-store';

interface SetupScreenProps {
  initialApiUrl: string;
  connecting: boolean;
  message: string;
  displayRotation: DisplayRotation;
  onSetDisplayRotation: (rotation: DisplayRotation) => Promise<void>;
  onConnect: (apiUrl: string) => Promise<void>;
}

function rotationValue(rotation: DisplayRotation): string {
  return rotation === 'system' ? 'Automatica / sistema' : `${rotation} graus`;
}

export function SetupScreen({
  initialApiUrl,
  connecting,
  message,
  displayRotation,
  onSetDisplayRotation,
  onConnect,
}: SetupScreenProps) {
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
      >
        <View style={styles.card}>
          <View style={styles.brandRow}>
            <Image
              accessibilityLabel="AquaFlora Agroshop"
              resizeMode="contain"
              source={brandLogo}
              style={styles.brandLogo}
            />
            <View>
              <Text style={styles.eyebrow}>AQUAFLORA AGROSHOP</Text>
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

          <View style={styles.orientationRow}>
            <View style={styles.orientationCopy}>
              <Text style={styles.label}>Orientacao da tela</Text>
              <Text style={styles.orientationValue}>
                {displayRotationLabel(displayRotation)} ({rotationValue(displayRotation)})
              </Text>
            </View>
            <TvButton
              disabled={connecting}
              label="Girar"
              onPress={() => void onSetDisplayRotation(nextDisplayRotation(displayRotation))}
              tone="secondary"
            />
          </View>

          <View style={styles.statusRow}>
            {connecting ? <ActivityIndicator color="#4ade80" size="small" /> : null}
            <Text style={styles.status}>{message}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: '#020b08',
    flex: 1,
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  glowTop: {
    backgroundColor: '#512a70',
    borderRadius: 260,
    height: 520,
    opacity: 0.32,
    position: 'absolute',
    right: -160,
    top: -220,
    width: 520,
  },
  glowBottom: {
    backgroundColor: '#ff5a12',
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
    flexShrink: 1,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
  },
  brandLogo: {
    height: 92,
    width: 92,
  },
  eyebrow: {
    color: '#f6aa18',
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
  orientationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
    marginTop: 22,
  },
  orientationCopy: {
    flex: 1,
  },
  orientationValue: {
    color: '#f0fdf4',
    fontSize: 18,
    marginTop: 4,
  },
  status: {
    color: '#86a995',
    flex: 1,
    fontSize: 15,
  },
});
