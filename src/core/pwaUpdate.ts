import { registerSW } from 'virtual:pwa-register';
import { reportCaughtError } from './reportError';

type UpdateState = {
  ready: boolean;
  offlineReady: boolean;
  panic: boolean;
  registerError: unknown | null;
};

type Listener = (state: UpdateState) => void;

let updateReady = false;
let offlineReady = false;
let panicMode = false;
let registerError: unknown | null = null;
let updateAction: ((reloadPage?: boolean) => void) | null = null;
const listeners = new Set<Listener>();

const notify = () => {
  const state = getUpdateState();
  listeners.forEach((listener) => listener(state));
};

const isChunkLoadError = (error: unknown) => {
  if (!error) return false;
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof (error as { message?: string }).message === 'string'
          ? (error as { message: string }).message
          : '';

  if (!message) return false;

  const chunkPatterns = [
    'Loading chunk',
    'ChunkLoadError',
    'dynamically imported module',
    'Failed to fetch dynamically imported module',
    'Importing a module script failed'
  ];

  return (
    chunkPatterns.some((pattern) => message.includes(pattern)) ||
    (message.includes('404') && message.includes('.js'))
  );
};

const triggerPanic = () => {
  if (panicMode) return;
  panicMode = true;
  notify();
};

export const initPwaUpdate = () => {
  try {
    updateAction = registerSW({
      onNeedRefresh() {
        updateReady = true;
        notify();
      },
      onOfflineReady() {
        offlineReady = true;
        notify();
      },
      onRegisterError(error) {
        registerError = error;
        console.warn('PWA registerSW failed:', error);
        notify();
      }
    });
  } catch (error) {
    reportCaughtError(error);
    registerError = error;
    console.warn('PWA registerSW failed:', error);
    notify();
  }

  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error ?? event.message)) {
      triggerPanic();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      triggerPanic();
    }
  });
};

export const onUpdateState = (listener: Listener) => {
  listeners.add(listener);
  listener(getUpdateState());
  return () => listeners.delete(listener);
};

export const checkForUpdate = () => {
  if (updateAction) {
    updateAction(false);
  }
};

export const applyUpdate = () => {
  if (updateAction) {
    updateAction(true);
  }
};

export const panicReset = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } finally {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
    const reload = window.location.reload as (forcedReload?: boolean) => void;
    reload(true);
  }
};

export const getUpdateState = (): UpdateState => ({
  ready: updateReady,
  offlineReady,
  panic: panicMode,
  registerError
});
