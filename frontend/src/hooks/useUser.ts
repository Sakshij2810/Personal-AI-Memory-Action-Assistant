import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUser } from "../apis/user.api";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
