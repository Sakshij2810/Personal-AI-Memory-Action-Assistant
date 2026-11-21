import axios from "axios";
import api from "../utils/axios";
import { server_base_endpoints } from "../utils/server_base_endpoints";

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
