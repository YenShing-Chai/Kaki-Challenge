import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../lib/auth';

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/(tabs)/discover" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
