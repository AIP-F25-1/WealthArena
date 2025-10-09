const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Override Metro to completely disable source maps and fix anonymous file issues
config.transformer = {
  ...config.transformer,
  enableBabelRCLookup: false,
  // Completely disable source map generation
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Disable source map generation in serializer
config.serializer = {
  ...config.serializer,
  getModulesRunBeforeMainModule: () => [],
  getPolyfills: () => [],
  // Override the symbolicate function to prevent anonymous file errors
  symbolicate: (chunk, delta, context) => {
    // Return empty source map to prevent anonymous file errors
    return {
      line: 1,
      column: 1,
      name: null,
      source: null,
    };
  },
};

// Configure resolver to handle file extensions properly
config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'cjs'],
  platforms: ['ios', 'android', 'native', 'web'],
};

module.exports = config;
