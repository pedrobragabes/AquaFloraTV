import * as SecureStore from 'expo-secure-store';

export interface PlayerSettings {
  apiUrl: string;
  deviceId: string;
  deviceToken: string;
  deviceName: string;
}

const settingsKey = 'aquatv.player.settings.v1';

function isPlayerSettings(value: unknown): value is PlayerSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<Record<keyof PlayerSettings, unknown>>;
  return (
    typeof candidate.apiUrl === 'string' &&
    candidate.apiUrl.trim().length > 0 &&
    typeof candidate.deviceId === 'string' &&
    candidate.deviceId.trim().length > 0 &&
    typeof candidate.deviceToken === 'string' &&
    candidate.deviceToken.trim().length > 0 &&
    typeof candidate.deviceName === 'string' &&
    candidate.deviceName.trim().length > 0
  );
}

export async function loadPlayerSettings(): Promise<PlayerSettings | null> {
  try {
    const raw = await SecureStore.getItemAsync(settingsKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isPlayerSettings(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function savePlayerSettings(settings: PlayerSettings): Promise<void> {
  await SecureStore.setItemAsync(settingsKey, JSON.stringify(settings));
}

export async function clearPlayerSettings(): Promise<void> {
  await SecureStore.deleteItemAsync(settingsKey);
}
