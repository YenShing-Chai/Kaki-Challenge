import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { apiRequest } from './api';
import { useAuth } from './auth';

/**
 * Once per signed-in session: request push permission (best-effort) and post the
 * resulting Expo push token to the server. Silently no-ops on web and on
 * Android Expo Go (which doesn't deliver push from SDK 53+).
 */
export function usePushTokenRegistration(): void {
  const { isSignedIn, isLoaded, getToken, user } = useAuth();
  const registeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (registeredFor.current === user.id) return;
    registeredFor.current = user.id;

    (async () => {
      if (Platform.OS === 'web') return;
      try {
        const settings = await Notifications.getPermissionsAsync();
        let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        if (!granted) {
          const next = await Notifications.requestPermissionsAsync();
          granted = next.granted || next.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        }
        if (!granted) return;
        const tokenResp = await Notifications.getExpoPushTokenAsync();
        const authToken = await getToken();
        await apiRequest('/users/push-token', {
          method: 'POST',
          token: authToken,
          body: { token: tokenResp.data },
        });
      } catch (err) {
        // Non-fatal — Expo Go on Android, Simulator, etc. throw here.
        registeredFor.current = null;
        console.warn('[kaki] push token registration failed', err);
      }
    })();
  }, [isLoaded, isSignedIn, user, getToken]);
}
