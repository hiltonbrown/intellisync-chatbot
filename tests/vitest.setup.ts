import '@testing-library/jest-dom/vitest';

type VitestMocker = {
  mock: (
    moduleId: string,
    factory: () => unknown,
    options?: { virtual?: boolean },
  ) => void;
};

const vitest = (globalThis as typeof globalThis & { vi?: VitestMocker }).vi;

vitest?.mock('katex/dist/katex.min.css', () => ({}), { virtual: true });

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverMock;
}
