import axios from "axios";
import api from "../utils/axios";
import { toast } from "sonner";

import { server_base_endpoints } from "../utils/server_base_endpoints";

export const getCurrentUser = async () => {
  try {
    const res = await api.get(server_base_endpoints.auth.me);
    return res.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      toast.error(
        error.response?.data?.message || "Error while fetching user data.",
      );
    } else {
      toast.error("Something went wrong.");
    }
  }
};
