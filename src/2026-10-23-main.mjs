import {createBrowserBridge} from './2026-10-23-browser-bridge.mjs';
window.previs=createBrowserBridge();
await import('./2026-10-23-app.mjs');
