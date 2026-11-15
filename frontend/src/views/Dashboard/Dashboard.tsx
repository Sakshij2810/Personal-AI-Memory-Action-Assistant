import { useState, type Dispatch, type SetStateAction } from "react";
import type { User } from "../../types/user";
import Sidebar from "./components/Sidebar";
import { useNavigate } from "react-router-dom";
import { REACT_APP_NAV_ROUTES } from "../../Router/AppNavigation";
import api from "../../utils/axios";
import { server_base_endpoints } from "../../utils/server_base_endpoints";
import { toast } from "sonner";
import axios from "axios";

interface DashboardProps {
  user: User;
  setUser: Dispatch<SetStateAction<User | null>>;
}
const Dashboard = ({ user, setUser }: DashboardProps) => {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // handle Logout
  const handleLogout = async () => {
    try {
      const res = await api.post(server_base_endpoints.auth.logout);
      if (res?.data?.success) {
        setUser(null);
        navigate("/");
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Error while logout.");
      } else {
        toast.error("Something went wrong.");
      }
    }
  };
  return (
    <div className="bg-white min-h-screen text-[#0A0A0A] font-sans flex">
      <Sidebar
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onLogout={handleLogout}
        onNewImageUpload={() => navigate(REACT_APP_NAV_ROUTES.upload_images)}
      />
      Hi, {user.display_name}!
    </div>
  );
};

export default Dashboard;
