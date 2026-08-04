export type DisplayRotation = 'system' | 0 | 90 | 270;

export const defaultDisplayRotation: DisplayRotation = 90;

export function isDisplayRotation(value: unknown): value is DisplayRotation {
  return value === 'system' || value === 0 || value === 90 || value === 270;
}

export function parseDisplayRotation(raw: string | null): DisplayRotation {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return isDisplayRotation(parsed) ? parsed : defaultDisplayRotation;
  } catch {
    return defaultDisplayRotation;
  }
}

export function nextDisplayRotation(rotation: DisplayRotation): DisplayRotation {
  if (rotation === 'system') {
    return 0;
  }
  if (rotation === 0) {
    return 90;
  }
  if (rotation === 90) {
    return 270;
  }
  return 'system';
}

export function displayRotationLabel(rotation: DisplayRotation): string {
  if (rotation === 'system') {
    return 'Automatica / sistema';
  }
  if (rotation === 0) {
    return 'Horizontal';
  }
  return rotation === 90 ? 'Vertical - lado A' : 'Vertical - lado B';
}
