// frontend/hooks/useAuth.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCurrentUser,
  loginWithGoogle,
  logoutUser,
} from "../apis/auth.api";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "../utils/firebase";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// Google login mutation.
export function useGoogleLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // 1. Open Google authentication popup.
      const result = await signInWithPopup(auth, provider);

      // 2. Get Firebase ID token.
      const token = await result.user.getIdToken();

      // 3. Authenticate with our backend.
      return loginWithGoogle(token);
    },

    onSuccess: (userData) => {
      // Update the existing current-user query cache.
      queryClient.setQueryData(["current-user"], userData);
    },
  });
}

// Logout mutation.
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,

    onSuccess: (data) => {
      if (data?.success) {
        // Remove cached user-specific data after successful logout.
        queryClient.clear();
      }
    },
  });
}
