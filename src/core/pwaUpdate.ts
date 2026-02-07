import { registerSW } from 'virtual:pwa-register';

type Listener = (ready: boolean) => void;

let updateReady = false;
let updateAction: (() => void) | null = null;
const listeners = new Set<Listener>();

export const initPwaUpdate = () => {
  updateAction = registerSW({
    onNeedRefresh() {
      updateReady = true;
      listeners.forEach((listener) => listener(true));
    },
    onOfflineReady() {
      listeners.forEach((listener) => listener(updateReady));
    }
  });
};

export const onUpdateReady = (listener: Listener) => {
  listeners.add(listener);
  listener(updateReady);
  return () => listeners.delete(listener);
};

export const triggerUpdate = () => {
  if (updateAction) {
    updateAction();
  }
};
