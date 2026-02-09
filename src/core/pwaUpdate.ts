import { registerSW } from 'virtual:pwa-register';
import { reportCaughtError } from './reportError';
import { safeClear } from './storage';

type UpdateState = {
  ready: boolean;
  offlineReady: boolean;
  panic: boolean;
  registerError: unknown | null;
};

type Listener = (state: UpdateState) => void;
type ServiceWorkerLogEntry = {
  message: string;
  source?: string;
  details?: Record<string, unknown>;
};

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

export const initPwaUpdate = (
  onServiceWorkerEvent?: (entry: ServiceWorkerLogEntry) => void
) => {
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
      onRegisteredSW(swUrl, registration) {
        onServiceWorkerEvent?.({
          message: 'service_worker_registered',
          source: swUrl,
          details: { scope: registration?.scope }
        });
        if (!registration) return;
        const reportWorkerState = (
          worker: ServiceWorker | null,
          label: string
        ) => {
          if (!worker) return;
          onServiceWorkerEvent?.({
            message: `service_worker_${label}`,
            source: worker.scriptURL,
            details: { state: worker.state }
          });
          worker.addEventListener('statechange', () => {
            onServiceWorkerEvent?.({
              message: `service_worker_${label}`,
              source: worker.scriptURL,
              details: { state: worker.state }
            });
          });
        };
        reportWorkerState(registration.installing, 'installing');
        reportWorkerState(registration.waiting, 'waiting');
        reportWorkerState(registration.active, 'active');
        registration.addEventListener('updatefound', () => {
          onServiceWorkerEvent?.({
            message: 'service_worker_updatefound',
            source: swUrl
          });
          reportWorkerState(registration.installing, 'installing');
        });
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

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const controller = navigator.serviceWorker.controller;
      onServiceWorkerEvent?.({
        message: 'service_worker_controllerchange',
        source: controller?.scriptURL,
        details: { state: controller?.state }
      });
    });
  }
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
  } catch (error) {
    reportCaughtError(error);
  }
  try {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    reportCaughtError(error);
  }
  safeClear();
  try {
    window.location.reload();
  } catch (error) {
    reportCaughtError(error);
  }
};

export const getUpdateState = (): UpdateState => ({
  ready: updateReady,
  offlineReady,
  panic: panicMode,
  registerError
});
