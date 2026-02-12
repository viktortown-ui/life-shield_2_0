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

type ServiceWorkerEventLogger = (entry: ServiceWorkerLogEntry) => void;

let updateReady = false;
let offlineReady = false;
let panicMode = false;
let registerError: unknown | null = null;
let updateAction: ((reloadPage?: boolean) => void) | null = null;
let serviceWorkerEventLogger: ServiceWorkerEventLogger | undefined;
const listeners = new Set<Listener>();
const PWA_UPDATE_SOURCE_FILE = 'src/core/pwaUpdate.ts';

const normalizeErrorDetails = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message || error.name || 'Unknown error',
      stack: error.stack,
      rawType: error.name || 'Error'
    };
  }
  return {
    message: typeof error === 'string' ? error : String(error),
    stack: undefined,
    rawType: error === null ? 'null' : typeof error
  };
};

const logPwaError = (stage: string, error: unknown) => {
  const normalized = normalizeErrorDetails(error);
  reportCaughtError(error);
  serviceWorkerEventLogger?.({
    message: `pwa_update_error:${stage}:${normalized.message}`,
    source: PWA_UPDATE_SOURCE_FILE,
    details: {
      stage,
      errorMessage: normalized.message,
      stack: normalized.stack,
      rawType: normalized.rawType,
      sourceFile: PWA_UPDATE_SOURCE_FILE
    }
  });
};

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
  serviceWorkerEventLogger = onServiceWorkerEvent;
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
        logPwaError('register_sw_callback', error);
        console.warn('PWA registerSW failed:', error);
        notify();
      }
    });
  } catch (error) {
    logPwaError('init_register_sw', error);
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
    try {
      updateAction(false);
    } catch (error) {
      logPwaError('check_for_update', error);
    }
  }
};

export const applyUpdate = () => {
  if (updateAction) {
    try {
      updateAction(true);
    } catch (error) {
      logPwaError('apply_update', error);
    }
  }
};

type PanicResetOptions = {
  clearUserData?: boolean;
};

export const panicReset = async (options: PanicResetOptions = {}) => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    logPwaError('panic_reset_unregister_sw', error);
  }
  try {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    logPwaError('panic_reset_clear_caches', error);
  }
  if (options.clearUserData) {
    safeClear();
  }
  try {
    window.location.reload();
  } catch (error) {
    logPwaError('panic_reset_reload', error);
  }
};

export const getUpdateState = (): UpdateState => ({
  ready: updateReady,
  offlineReady,
  panic: panicMode,
  registerError
});


export const __unsafeResetPwaUpdateStateForTests = () => {
  updateReady = false;
  offlineReady = false;
  panicMode = false;
  registerError = null;
  updateAction = null;
  listeners.clear();
  serviceWorkerEventLogger = undefined;
};
