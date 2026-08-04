import * as SecureStore from 'expo-secure-store';

import {
  defaultDisplayRotation,
  parseDisplayRotation,
  type DisplayRotation,
} from './display-orientation';

export {
  defaultDisplayRotation,
  displayRotationLabel,
  isDisplayRotation,
  nextDisplayRotation,
  parseDisplayRotation,
} from './display-orientation';
export type { DisplayRotation } from './display-orientation';

const displayRotationKey = 'aquatv.player.display-rotation.v1';

export async function loadDisplayRotation(): Promise<DisplayRotation> {
  try {
    const raw = await SecureStore.getItemAsync(displayRotationKey);
    return parseDisplayRotation(raw);
  } catch {
    return defaultDisplayRotation;
  }
}

export async function saveDisplayRotation(rotation: DisplayRotation): Promise<void> {
  await SecureStore.setItemAsync(displayRotationKey, JSON.stringify(rotation));
}
