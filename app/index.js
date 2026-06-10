// Entry point — keep this file as the `main` in package.json.
// Monorepo + EAS Build resolution of "expo-router/entry" is flaky;
// importing it from a local file we own avoids the AppEntry.js fallback.
import 'expo-router/entry';
