// Metro: default Expo config wrapped by NativeWind so Tailwind classes compile.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
// pdf.js ships as `.txt` assets for the Android PDF viewer (see scripts/vendor-pdfjs.mjs).
config.resolver.assetExts.push("txt");

module.exports = withNativeWind(config, { input: "./global.css" });
