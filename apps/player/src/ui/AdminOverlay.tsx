import { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import brandLogo from '../../assets/brand/aquaflora-logo.webp';
import type { PlayerPhase } from '../mobile/use-player-runtime';
import {
  displayRotationLabel,
  nextDisplayRotation,
  type DisplayRotation,
} from '../mobile/display-orientation-store';
import type { PlayerSettings } from '../mobile/settings-store';
import type { CacheProgress } from '../mobile/media-cache';
import { TvButton } from './TvButton';

interface AdminOverlayProps {
  settings: PlayerSettings;
  phase: PlayerPhase;
  message: string;
  lastSyncAt: Date | null;
  lastPlaybackError: string | null;
  cacheProgress: CacheProgress;
  displayRotation: DisplayRotation;
  onClose: () => void;
  onSetDisplayRotation: (rotation: DisplayRotation) => Promise<void>;
  onToggleAudio: () => Promise<void>;
  onResetConnection: () => Promise<void>;
  onSync: () => Promise<void>;
}

function formatSyncTime(value: Date | null): string {
  return value ? value.toLocaleString('pt-BR') : 'Ainda nao sincronizou';
}

function rotationValue(rotation: DisplayRotation): string {
  return rotation === 'system' ? 'Automatica / sistema' : `${rotation} graus`;
}

export function AdminOverlay({
  settings,
  phase,
  message,
  lastSyncAt,
  lastPlaybackError,
  cacheProgress,
  displayRotation,
  onClose,
  onSetDisplayRotation,
  onToggleAudio,
  onResetConnection,
  onSync,
}: AdminOverlayProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const syncing = phase === 'syncing' || cacheProgress.total > 0;

  return (
    <ScrollView
      accessibilityViewIsModal
      contentContainerStyle={styles.backdropContent}
      style={styles.backdrop}
    >
      <View style={styles.panel}>
        <Image
          accessibilityLabel="AquaFlora Agroshop"
          resizeMode="contain"
          source={brandLogo}
          style={styles.brandLogo}
        />
        <Text style={styles.eyebrow}>ADMINISTRACAO LOCAL</Text>
        <Text style={styles.title}>AquaTV</Text>

        <View style={styles.details}>
          <Text style={styles.label}>API</Text>
          <Text numberOfLines={1} style={styles.value}>
            {settings.apiUrl}
          </Text>
          <Text style={styles.label}>DEVICE</Text>
          <Text style={styles.value}>{settings.deviceId.slice(0, 12)}</Text>
          <Text style={styles.label}>ESTADO</Text>
          <Text style={styles.value}>{message}</Text>
          <Text style={styles.label}>SOM</Text>
          <Text style={styles.value}>{settings.audioEnabled ? 'Ativado' : 'Desativado'}</Text>
          <Text style={styles.label}>ORIENTACAO</Text>
          <Text style={styles.value}>
            {displayRotationLabel(displayRotation)} ({rotationValue(displayRotation)})
          </Text>
          <Text style={styles.label}>ULTIMO SYNC</Text>
          <Text style={styles.value}>{formatSyncTime(lastSyncAt)}</Text>
          {lastPlaybackError ? (
            <>
              <Text style={styles.errorLabel}>ULTIMO ERRO DE MIDIA</Text>
              <Text style={styles.errorValue}>{lastPlaybackError}</Text>
            </>
          ) : null}
          {cacheProgress.total > 0 ? (
            <Text style={styles.progress}>
              Cache {cacheProgress.done}/{cacheProgress.total}
              {cacheProgress.currentName ? ` - ${cacheProgress.currentName}` : ''}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <TvButton hasTVPreferredFocus label="Fechar" onPress={onClose} />
          <TvButton
            disabled={syncing}
            label={syncing ? 'Sincronizando...' : 'Sincronizar agora'}
            onPress={() => void onSync().catch(() => undefined)}
            tone="secondary"
          />
          <TvButton
            label={settings.audioEnabled ? 'Desativar som' : 'Ativar som'}
            onPress={() => void onToggleAudio()}
            tone="secondary"
          />
          <TvButton
            label="Girar tela"
            onPress={() => void onSetDisplayRotation(nextDisplayRotation(displayRotation))}
            tone="secondary"
          />
          <TvButton
            label={confirmReset ? 'Confirmar reconexao' : 'Reconectar'}
            onPress={() => {
              if (confirmReset) {
                void onResetConnection();
              } else {
                setConfirmReset(true);
              }
            }}
            tone={confirmReset ? 'danger' : 'secondary'}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 8, 5, 0.94)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  backdropContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: 24,
  },
  panel: {
    backgroundColor: '#07150f',
    borderColor: '#315844',
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 760,
    padding: 30,
    flexShrink: 1,
    width: '100%',
  },
  brandLogo: {
    alignSelf: 'flex-start',
    height: 72,
    marginBottom: 6,
    width: 72,
  },
  eyebrow: {
    color: '#f6aa18',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  title: {
    color: '#f0fdf4',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  details: {
    backgroundColor: '#020b08',
    borderRadius: 14,
    marginTop: 22,
    padding: 20,
  },
  label: {
    color: '#648274',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 10,
  },
  value: {
    color: '#dcfce7',
    fontSize: 16,
    marginTop: 3,
  },
  errorLabel: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 14,
  },
  errorValue: {
    color: '#fecaca',
    fontSize: 15,
    marginTop: 3,
  },
  progress: {
    color: '#86efac',
    fontSize: 14,
    marginTop: 14,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 22,
  },
});
