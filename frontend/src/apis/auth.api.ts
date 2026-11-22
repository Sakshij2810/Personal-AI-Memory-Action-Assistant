// frontend/hooks/auth.api.ts

import axios from "axios";
import api from "../utils/axios";
import { server_base_endpoints } from "../utils/server_base_endpoints";

// Fetch Current User
export const fetchCurrentUser = async () => {
  try {
    const { data } = await api.get(server_base_endpoints.auth.me);
    return data;
  } catch (error: unknown) {
    // A visitor without a session is not an application error.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return { user: null };
    }

    // Let TanStack Query handle unexpected errors.
    throw error;
  }
};

// Login
export const loginWithGoogle = async (token: string) => {
  const { data } = await api.post(server_base_endpoints.auth.login, { token });
  return data;
};

// Logout
export const logoutUser = async () => {
  const { data } = await api.post(server_base_endpoints.auth.logout);

  return data;
};
