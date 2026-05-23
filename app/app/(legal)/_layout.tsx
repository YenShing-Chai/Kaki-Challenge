import { Stack } from 'expo-router';

import { colorsB } from '../../lib/themeB';

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colorsB.bg },
        headerTintColor: colorsB.ink,
        headerTitleStyle: { fontWeight: '900', fontSize: 14 },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
      }}
    />
  );
}
