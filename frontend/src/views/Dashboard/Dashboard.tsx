import type { User } from "../../types/user";

interface DashboardProps {
  user: User;
}

const Dashboard = ({ user }: DashboardProps) => {
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Welcome, {user.display_name ?? "User"}
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Start organizing your personal memories.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
