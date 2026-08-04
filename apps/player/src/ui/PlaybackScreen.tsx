import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';

import type { CurrentPlaylistItem } from '@aquatv/types';
import type { DisplayRotation } from '../mobile/display-orientation-store';

interface PlaybackScreenProps {
  item: CurrentPlaylistItem;
  mediaUri: string;
  muted: boolean;
  displayRotation: DisplayRotation;
  onAdvance: () => void;
  onError: (message: string) => void;
  onAdminRequest: () => void;
}

const fallbackImageDurationMs = 10_000;
const mediaLoadTimeoutMs = 30_000;
const videoStallTimeoutMs = 35_000;
const errorDelayMs = 1_500;

function mediaStyle(
  rotation: DisplayRotation,
  windowWidth: number,
  windowHeight: number,
): { height: number; transform: [{ rotate: string }]; width: number } | undefined {
  if (rotation === 'system' || rotation === 0) {
    return undefined;
  }

  return {
    height: windowWidth,
    transform: [{ rotate: `${rotation}deg` }],
    width: windowHeight,
  };
}

function useCompletion(onAdvance: () => void, onError: (message: string) => void) {
  const completedRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    },
    [],
  );

  const complete = useCallback((): void => {
    if (completedRef.current) {
      return;
    }
    completedRef.current = true;
    onAdvance();
  }, [onAdvance]);

  const fail = useCallback(
    (message: string): void => {
      if (completedRef.current) {
        return;
      }
      completedRef.current = true;
      errorTimerRef.current = setTimeout(() => onError(message), errorDelayMs);
    },
    [onError],
  );

  return { complete, fail };
}

function ImageMedia({
  item,
  mediaUri,
  displayRotation,
  onAdvance,
  onError,
}: Omit<PlaybackScreenProps, 'onAdminRequest' | 'muted'>) {
  const [loaded, setLoaded] = useState(false);
  const { complete, fail } = useCompletion(onAdvance, onError);
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (loaded) {
      return undefined;
    }
    const timer = setTimeout(
      () => fail(`Imagem nao carregou: ${item.media.storedName}`),
      mediaLoadTimeoutMs,
    );
    return () => clearTimeout(timer);
  }, [fail, item.media.storedName, loaded]);

  useEffect(() => {
    if (!loaded) {
      return undefined;
    }
    const duration = item.durationOverrideMs ?? fallbackImageDurationMs;
    const timer = setTimeout(complete, Math.max(duration, 1_000));
    return () => clearTimeout(timer);
  }, [complete, item.durationOverrideMs, loaded]);

  return (
    <Image
      onError={() => fail(`Imagem invalida: ${item.media.storedName}`)}
      onLoad={() => setLoaded(true)}
      resizeMode="contain"
      source={{ uri: mediaUri }}
      style={[styles.media, mediaStyle(displayRotation, width, height)]}
    />
  );
}

function VideoMedia({
  item,
  mediaUri,
  muted,
  displayRotation,
  onAdvance,
  onError,
}: Omit<PlaybackScreenProps, 'onAdminRequest'>) {
  const { complete, fail } = useCompletion(onAdvance, onError);
  const { width, height } = useWindowDimensions();
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProgressRef = useRef<number | null>(null);

  const clearWatchdog = useCallback((): void => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const armWatchdog = useCallback((): void => {
    clearWatchdog();
    watchdogRef.current = setTimeout(
      () => fail(`Video travou: ${item.media.storedName}`),
      videoStallTimeoutMs,
    );
  }, [clearWatchdog, fail, item.media.storedName]);

  const player = useVideoPlayer(mediaUri, (instance) => {
    instance.loop = false;
    instance.muted = muted;
    instance.timeUpdateEventInterval = 2;
    instance.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEventListener(player, 'playToEnd', () => {
    clearWatchdog();
    complete();
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    const previousTime = lastProgressRef.current;
    if (previousTime === null || currentTime > previousTime + 0.05) {
      lastProgressRef.current = currentTime;
      armWatchdog();
    }
  });
  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'error') {
      clearWatchdog();
      fail(error?.message ?? `Video invalido: ${item.media.storedName}`);
      return;
    }
    if (status === 'readyToPlay') {
      armWatchdog();
      player.play();
    }
  });

  useEffect(() => {
    armWatchdog();
    return clearWatchdog;
  }, [armWatchdog, clearWatchdog]);

  return (
    <VideoView
      contentFit="contain"
      fullscreenOptions={{ enable: false }}
      nativeControls={false}
      onFirstFrameRender={armWatchdog}
      player={player}
      style={[styles.media, mediaStyle(displayRotation, width, height)]}
      surfaceType="textureView"
    />
  );
}

function UnsupportedMedia({ item, onError }: Pick<PlaybackScreenProps, 'item' | 'onError'>) {
  useEffect(() => {
    const timer = setTimeout(
      () => onError(`Formato nao suportado: ${item.media.mimetype}`),
      errorDelayMs,
    );
    return () => clearTimeout(timer);
  }, [item.media.mimetype, onError]);

  return <Text style={styles.invisibleText}>Formato nao suportado</Text>;
}

export function PlaybackScreen({
  item,
  mediaUri,
  muted,
  displayRotation,
  onAdvance,
  onError,
  onAdminRequest,
}: PlaybackScreenProps) {
  const isVideo = item.media.mimetype.startsWith('video/');
  const isImage = item.media.mimetype.startsWith('image/');

  return (
    <Pressable
      delayLongPress={1_500}
      focusable
      hasTVPreferredFocus
      onLongPress={onAdminRequest}
      style={styles.stage}
    >
      {isVideo ? (
        <VideoMedia
          displayRotation={displayRotation}
          item={item}
          mediaUri={mediaUri}
          muted={muted}
          onAdvance={onAdvance}
          onError={onError}
        />
      ) : null}
      {isImage ? (
        <ImageMedia
          displayRotation={displayRotation}
          item={item}
          mediaUri={mediaUri}
          onAdvance={onAdvance}
          onError={onError}
        />
      ) : null}
      {!isVideo && !isImage ? <UnsupportedMedia item={item} onError={onError} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    backgroundColor: '#000000',
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  media: {
    height: '100%',
    width: '100%',
  },
  invisibleText: {
    color: '#000000',
    fontSize: 1,
  },
});
