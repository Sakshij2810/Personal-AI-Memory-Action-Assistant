import { type Dispatch, type SetStateAction } from "react";
import type { User } from "../../types/user";
import Sidebar from "./components/Sidebar";

interface DashboardProps {
  user: User;
  setUser: Dispatch<SetStateAction<User | null>>;
}
const Dashboard = ({ user, setUser }: DashboardProps) => {
  return (
    <div className="bg-white min-h-screen text-[#0A0A0A] font-sans flex">
      <Sidebar user={user} setUser={setUser} />

      <main className="min-w-0 flex-1 bg-gray-50 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">
            Welcome, {user.display_name ?? "User"}
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Start organizing your personal memories.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
