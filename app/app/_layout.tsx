import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { AuthProvider, useAuth } from '../lib/auth';
import { queryClient } from '../lib/queryClient';
import { useSyncUser } from '../lib/useSyncUser';
import { usePushTokenRegistration } from '../lib/usePushTokenRegistration';

function InnerRoot() {
  useSyncUser();
  usePushTokenRegistration();
  return (
    <>
      <OfflineBanner />
      <Slot />
    </>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  if (!isLoaded) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate>
          <QueryClientProvider client={queryClient}>
            <SafeAreaProvider>
              <StatusBar style="auto" />
              <InnerRoot />
            </SafeAreaProvider>
          </QueryClientProvider>
        </AuthGate>
      </AuthProvider>
    </ErrorBoundary>
  );
}
