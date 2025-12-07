// CRITICAL: React.use polyfill must be applied BEFORE any React imports
// This ensures expo-router can use React.use when it loads

// Global polyfills for better compatibility
if (typeof global !== 'undefined') {
  // Ensure global is available
  global.global = global;
}

// Ensure require is available globally for compatibility
if (typeof global.require === 'undefined') {
  global.require = require;
}

// Polyfill for TextEncoder/TextDecoder if not available
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('@stardazed/streams-text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Polyfill for structuredClone if not available
if (typeof global.structuredClone === 'undefined') {
  const { structuredClone } = require('@ungap/structured-clone');
  global.structuredClone = structuredClone;
}

// React 19 includes React.use. No runtime polyfill needed when using expected versions.
