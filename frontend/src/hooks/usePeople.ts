// frontend/src/hooks/usePeople.ts

import { useQuery } from "@tanstack/react-query";
import { fetchPeople } from "../apis/face-groups.api";

export const usePeople = () => {
  return useQuery({
    queryKey: ["people"],
    queryFn: fetchPeople,
  });
};
