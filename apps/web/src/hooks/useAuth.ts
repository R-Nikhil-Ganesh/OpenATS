'use client';

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { getAccessToken, setTokens, clearTokens } from '@/lib/auth';

type User = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export function useAuth() {
  const queryClient = useQueryClient();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const hasToken = !!getAccessToken();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await authApi.me();
      return res.data;
    },
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useCallback(
    async (credentials: { tenantSlug: string; email: string; password: string }) => {
      setIsLoggingIn(true);
      try {
        const res = await authApi.login(credentials);
        const { accessToken, refreshToken } = res.data;
        setTokens(accessToken, refreshToken);
        await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      } finally {
        setIsLoggingIn(false);
      }
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {}
    clearTokens();
    queryClient.clear();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [queryClient]);

  return {
    user,
    isLoading: isLoading || isLoggingIn,
    isError,
    isAuthenticated: !!user && !isError,
    login,
    logout,
  };
}
