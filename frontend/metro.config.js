const { getDefaultConfig } = require('expo/metro-config');

// Use Expo's default Metro configuration and tweak symbolicator to ignore Hermes internal frames
const config = getDefaultConfig(__dirname);

config.symbolicator = config.symbolicator || {};
config.symbolicator.customizeFrame = (frame) => {
  try {
    // Hide noisy Hermes/bytecode and Metro internal frames
    const file = frame?.file || '';
    const methodName = frame?.methodName || '';
    const isInternalBytecode = file.includes('InternalBytecode') || methodName.includes('InternalBytecode');
    const isHermesInternal = file.includes('HermesInternal') || methodName.includes('HermesInternal');
    const isMetroInternal = file.includes('node_modules/metro') || file.includes('metro/src');

    if (isInternalBytecode || isHermesInternal || isMetroInternal) {
      return { ...frame, collapse: true };
    }
  } catch (_) {}
  return frame;
};

module.exports = config;
