// The container ships one Playwright with a matching Chromium. Load that one
// through CommonJS resolution (NODE_PATH) rather than installing a second copy,
// which would look for a browser build that is not there.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
