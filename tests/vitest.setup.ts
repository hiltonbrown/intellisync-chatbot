import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('katex/dist/katex.min.css', () => ({}), { virtual: true });

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  // @ts-expect-error - providing minimal mock for jsdom
  globalThis.ResizeObserver = ResizeObserverMock;
}

