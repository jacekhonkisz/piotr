/**
 * Jest Setup for Production-Ready Testing
 */

// Skip jest-dom for now to avoid dependency issues
// require('@testing-library/jest-dom');

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NODE_ENV = 'test';

// Mock performance API for Node.js environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    clearMarks: () => {},
    clearMeasures: () => {}
  };
}

// Mock console methods to reduce test noise
const originalConsole = { ...console };
global.console = {
  ...console,
  // Keep error and warn for debugging
  error: originalConsole.error,
  warn: originalConsole.warn,
  // Suppress info and debug in tests
  info: jest.fn(),
  debug: jest.fn(),
  log: jest.fn()
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock AbortController
global.AbortController = class AbortController {
  signal = {
    aborted: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  
  abort() {
    this.signal.aborted = true;
  }
};

// Mock setTimeout and clearTimeout for consistent testing
const originalSetTimeout = setTimeout;
const originalClearTimeout = clearTimeout;
const originalSetInterval = setInterval;
const originalClearInterval = clearInterval;

global.setTimeout = jest.fn((callback, delay) => {
  return originalSetTimeout(callback, delay);
});

global.clearTimeout = jest.fn((id) => {
  return originalClearTimeout(id);
});

// Mock setInterval and clearInterval
global.setInterval = jest.fn((callback, delay) => {
  return originalSetInterval(callback, delay);
});

global.clearInterval = jest.fn((id) => {
  return originalClearInterval(id);
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};
global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = localStorageMock;

// Mock window object
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: ''
  },
  writable: true
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock crypto for Node.js environment
if (typeof crypto === 'undefined') {
  global.crypto = {
    getRandomValues: (arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  };
}

// Setup test database helpers
export const setupTestDatabase = () => {
  // Mock database operations for tests
  return {
    cleanup: jest.fn(),
    seed: jest.fn(),
    reset: jest.fn()
  };
};

// Test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
});

export const createMockProfile = (overrides = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'client',
  full_name: 'Test User',
  avatar_url: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
});

export const createMockClient = (overrides = {}) => ({
  id: 'test-client-123',
  admin_id: 'test-admin-123',
  name: 'Test Client',
  email: 'client@example.com',
  company: 'Test Company',
  ad_account_id: '123456789',
  api_status: 'valid',
  reporting_frequency: 'monthly',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
});

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  
  // Clear localStorage mock
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  
  // Reset fetch mock
  if (global.fetch) {
    global.fetch.mockClear();
  }
});

// Global test timeout
jest.setTimeout(10000); // 10 seconds