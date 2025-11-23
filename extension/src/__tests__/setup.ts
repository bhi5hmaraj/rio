/**
 * Jest test setup
 * Runs before all tests
 */

import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { webcrypto } from 'crypto';

// Polyfill fetch for integration tests
// Node.js 18+ has native fetch, but it might not be available in jsdom
// We'll just expose it globally if it exists
if (typeof global.fetch === 'undefined') {
  // Try to use Node.js built-in fetch (Node 18+)
  try {
    // @ts-ignore - Node.js 18+ has fetch
    const nodeFetch = globalThis.fetch || require('undici').fetch;
    global.fetch = nodeFetch as any;
  } catch {
    console.warn('fetch not available - integration tests may fail');
  }
}

// Polyfill TextEncoder/TextDecoder for jsdom environment
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Polyfill Web Crypto API for jsdom environment
Object.defineProperty(global, 'crypto', {
  value: webcrypto,
});

// Mock Chrome Extension APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    onInstalled: {
      addListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  sidePanel: {
    open: jest.fn(),
  },
  action: {
    onClicked: {
      addListener: jest.fn(),
    },
  },
  contextMenus: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
} as any;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};
