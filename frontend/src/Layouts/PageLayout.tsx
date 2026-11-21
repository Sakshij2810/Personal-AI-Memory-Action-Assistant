import { Outlet } from "react-router-dom";
import type { User } from "../types/user";
import Sidebar from "../views/Dashboard/components/Sidebar";

interface PageLayoutProps {
  user: User;
}

const PageLayout = ({ user }: PageLayoutProps) => {
  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-[#0A0A0A]">
      {/* Shared sidebar */}
      <Sidebar user={user} />

      {/* Current page renders here */}
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default PageLayout;
