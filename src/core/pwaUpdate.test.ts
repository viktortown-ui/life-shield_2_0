import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  registerSWMock: vi.fn(),
  safeClearMock: vi.fn()
}));

vi.mock('virtual:pwa-register', () => ({
  registerSW: mocks.registerSWMock
}));

vi.mock('./storage', () => ({
  safeClear: mocks.safeClearMock
}));

import {
  __unsafeResetPwaUpdateStateForTests,
  getUpdateState,
  initPwaUpdate,
  panicReset
} from './pwaUpdate';

beforeEach(() => {
  __unsafeResetPwaUpdateStateForTests();
  mocks.registerSWMock.mockReset();
  mocks.safeClearMock.mockReset();
  vi.restoreAllMocks();
});

describe('pwaUpdate', () => {
  it('sets update state ready when waiting service worker is detected', () => {
    let capturedOptions: { onNeedRefresh?: () => void } | undefined;
    mocks.registerSWMock.mockImplementation((options: { onNeedRefresh?: () => void }) => {
      capturedOptions = options;
      return vi.fn();
    });

    initPwaUpdate();
    capturedOptions?.onNeedRefresh?.();

    expect(getUpdateState().ready).toBe(true);
  });

  it('switches to panic mode on chunk load errors', () => {
    mocks.registerSWMock.mockReturnValue(vi.fn());

    initPwaUpdate();
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'Failed to fetch dynamically imported module'
      })
    );

    expect(getUpdateState().panic).toBe(true);
  });

  it('does not clear user data on panic reset by default', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations }
    });
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['pwa-cache']),
      delete: vi.fn().mockResolvedValue(true)
    });
    await panicReset();

    expect(mocks.safeClearMock).not.toHaveBeenCalled();
    expect(unregister).toHaveBeenCalledTimes(1);
  });
});
