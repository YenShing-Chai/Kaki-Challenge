/**
 * Fallback root component for EAS Build.
 *
 * Locally and in normal Expo Router setups the entry point is
 * `expo-router/entry` (re-exported via `./index.js`). But EAS Build in a
 * monorepo workspace sometimes loads `node_modules/expo/AppEntry.js`
 * which hard-imports `App` from project root.
 *
 * This file makes that fallback path work: it exports a default React
 * component that mounts Expo Router with our `./app/` route directory.
 */
import { ExpoRoot } from 'expo-router';

export default function App() {
  // @ts-expect-error — require.context is a Metro runtime helper, no static type.
  const ctx = require.context('./app');
  return <ExpoRoot context={ctx} />;
}
