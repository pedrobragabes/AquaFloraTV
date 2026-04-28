import type { Response } from 'express';

const deviceStreams = new Map<string, Set<Response>>();

export function sendSseEvent(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function addDeviceListener(deviceId: string, res: Response): void {
  const listeners = deviceStreams.get(deviceId) ?? new Set<Response>();
  listeners.add(res);
  deviceStreams.set(deviceId, listeners);
}

export function removeDeviceListener(deviceId: string, res: Response): void {
  const listeners = deviceStreams.get(deviceId);
  if (!listeners) {
    return;
  }

  listeners.delete(res);
  if (listeners.size === 0) {
    deviceStreams.delete(deviceId);
    return;
  }

  deviceStreams.set(deviceId, listeners);
}

export function getDeviceListenerCount(deviceId: string): number {
  return deviceStreams.get(deviceId)?.size ?? 0;
}

export function broadcastDeviceSync(reason: string, deviceId?: string): number {
  const entries = deviceId
    ? ([[deviceId, deviceStreams.get(deviceId) ?? new Set<Response>()]] as const)
    : Array.from(deviceStreams.entries());
  let listenerCount = 0;

  for (const [, listeners] of entries) {
    for (const listener of listeners) {
      sendSseEvent(listener, 'sync', { reason });
      listenerCount += 1;
    }
  }

  return listenerCount;
}
