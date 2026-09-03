// Babel: Expo preset with NativeWind's JSX transform, plus the worklets plugin
// required by react-native-reanimated (must stay last).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: ["react-native-worklets/plugin"],
  };
};
