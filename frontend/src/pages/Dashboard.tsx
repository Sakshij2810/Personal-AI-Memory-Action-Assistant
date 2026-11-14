import type { Dispatch, SetStateAction } from "react";
import type { User } from "../types/user";

interface DashboardProps {
  user: User;
  setUser: Dispatch<SetStateAction<User | null>>;
}
const Dashboard = ({ user, setUser }: DashboardProps) => {
  return <div className="text-black">Hi, {user.display_name}!</div>;
};

export default Dashboard;
