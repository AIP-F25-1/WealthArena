module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', {
        jsxImportSource: 'react',
        lazyImports: true
      }]
    ],
    plugins: [
      ['@babel/plugin-transform-runtime', {
        'regenerator': true,
        'helpers': true,
        'useESModules': false
      }],
      'react-native-reanimated/plugin'
    ],
  };
};
