import { useAuth } from '../lib/auth';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useCurrentUser } from '../lib/useCurrentUser';

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, loading } = useCurrentUser();

  if (!isLoaded) return <Spinner />;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (loading) return <Spinner />;
  if (!user?.hasCompletedOnboarding) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

function Spinner() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
