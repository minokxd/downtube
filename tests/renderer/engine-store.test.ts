import type { EngineStatus } from '@shared/types';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const READY: EngineStatus = { ready: true, components: [] };

const status = vi.fn<() => Promise<EngineStatus>>();
const install = vi.fn<(force?: boolean) => Promise<EngineStatus>>();

type EngineModule = typeof import('../../src/renderer/src/stores/engine');
let engine: EngineModule;

beforeAll(async () => {
  vi.stubGlobal('window', { downtube: { engine: { status, install } } });
  engine = await import('../../src/renderer/src/stores/engine');
});

beforeEach(() => {
  status.mockReset();
  install.mockReset();
  engine.useEngine.setState({ status: null, installing: false, installError: null, progress: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('engine store install()', () => {
  it('stores the new status on success', async () => {
    install.mockResolvedValue(READY);
    await engine.useEngine.getState().install();
    expect(engine.useEngine.getState()).toMatchObject({ status: READY, installing: false, installError: null });
  });

  it('records the error and re-reads the status when the install fails', async () => {
    install.mockRejectedValue(new Error('disk full'));
    status.mockResolvedValue(READY);
    await engine.useEngine.getState().install();
    expect(engine.useEngine.getState()).toMatchObject({ status: READY, installing: false, installError: 'disk full' });
  });

  it('does not reject when the status read after a failed install fails too', async () => {
    install.mockRejectedValue(new Error('disk full'));
    status.mockRejectedValue(new Error('EBUSY'));
    await expect(engine.useEngine.getState().install()).resolves.toBeUndefined();
    expect(engine.useEngine.getState()).toMatchObject({ installing: false, installError: 'disk full' });
  });
});
