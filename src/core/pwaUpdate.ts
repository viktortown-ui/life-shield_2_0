import { registerSW } from 'virtual:pwa-register';

type UpdateState = {
  ready: boolean;
  offlineReady: boolean;
};

type Listener = (state: UpdateState) => void;

let updateReady = false;
let offlineReady = false;
let updateAction: ((reloadPage?: boolean) => void) | null = null;
const listeners = new Set<Listener>();

const notify = () => {
  const state = getUpdateState();
  listeners.forEach((listener) => listener(state));
};

export const initPwaUpdate = () => {
  updateAction = registerSW({
    onNeedRefresh() {
      updateReady = true;
      notify();
    },
    onOfflineReady() {
      offlineReady = true;
      notify();
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

export const getUpdateState = (): UpdateState => ({
  ready: updateReady,
  offlineReady
});
