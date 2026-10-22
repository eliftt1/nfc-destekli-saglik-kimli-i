import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../i18n/index.js';
import { resetCsrf } from '../api/client.js';

beforeEach(async () => {
  await i18n.changeLanguage('tr');
  resetCsrf();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
