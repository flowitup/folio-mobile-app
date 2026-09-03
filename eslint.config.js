// ESLint flat config: Expo's shared rules; generated API types are excluded.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["node_modules/*", "src/api/generated/*", ".expo/*"],
  },
]);
