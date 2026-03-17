"use client";

import { useAuth } from "@/components/auth-provider";
import { useCallback } from "react";

/**
 * Hook that returns a fetch wrapper with Firebase auth token attached.
 */
export function useAuthFetch() {
  const { user } = useAuth();

  const authFetch = useCallback(
    async (url, options = {}) => {
      if (!user) throw new Error("Not authenticated");

      const token = await user.getIdToken();
      const headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };

      return fetch(url, { ...options, headers });
    },
    [user]
  );

  return authFetch;
}
