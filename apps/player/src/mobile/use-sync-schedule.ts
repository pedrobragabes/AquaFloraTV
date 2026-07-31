import { useEffect, type RefObject } from 'react';
import { AppState } from 'react-native';

const pollIntervalMs = 15_000;
const maximumPollIntervalMs = 2 * 60_000;

function getPollDelay(failureCount: number): number {
  return Math.min(pollIntervalMs * 2 ** Math.min(failureCount, 3), maximumPollIntervalMs);
}

export function useSyncSchedule(
  enabled: boolean,
  sync: () => Promise<void>,
  failureCountRef: RefObject<number>,
): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (): void => {
      timer = setTimeout(() => {
        void sync()
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) {
              schedule();
            }
          });
      }, getPollDelay(failureCountRef.current));
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [enabled, failureCountRef, sync]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && previousState !== 'active') {
        void sync().catch(() => undefined);
      }
      previousState = nextState;
    });

    return () => subscription.remove();
  }, [enabled, sync]);
}
