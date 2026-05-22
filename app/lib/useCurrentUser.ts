import { useAuth } from './auth';
import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from './api';

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  hasCompletedOnboarding: boolean;
  stripePaymentMethodId: string | null;
  timezone: string;
};

export function useCurrentUser(): {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const { user: u } = await apiRequest<{ user: CurrentUser | null }>('/users/me', { token });
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, loading, refresh };
}
