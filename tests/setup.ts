import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * Os módulos compartilhados das Edge Functions rodam em Deno.
 * Aqui damos um `Deno.env` mínimo para poder testá-los no Vitest.
 */
if (!("Deno" in globalThis)) {
  Object.defineProperty(globalThis, "Deno", {
    configurable: true,
    value: {
      env: { get: (key: string) => process.env[key] },
      resolveDns: undefined,
    },
  });
}

// jsdom não implementa matchMedia, usado por prefers-reduced-motion.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
