import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import type { User } from "./types/user";
import { getCurrentUser } from "./apis/user.api";

import Home from "./views/Home/Home";
import Dashboard from "./views/Dashboard/Dashboard";
import UploadImages from "./views/MediaUploads/UploadImages";
import ImageGallery from "./views/Storage/ImageGallery";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const data = await getCurrentUser();
        setUser(data?.user);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, []);

  if (loading) {
    return (
      <div className="fixed top-0 left-0 w-full z-[9999]">
        <div className="h-1 bg-black animate-pulse w-full" />
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={3000}
        theme="dark"
      />

      <Routes>
        {/* ------------------- Home ------------------- */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Home setUser={setUser} />
            )
          }
        />
        {/* ------------------- Dashboard ------------------- */}
        <Route
          path="/dashboard"
          element={
            user ? (
              <Dashboard user={user} setUser={setUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* ------------------- Media Uploads ------------------- */}
        <Route
          path="/upload-images"
          element={
            user ? (
              <UploadImages user={user} setUser={setUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        {/* ------------------- Storage ------------------- */}
        <Route
          path="/image_gallery"
          element={
            user ? (
              <ImageGallery user={user} setUser={setUser} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
      </Routes>
    </>
  );
}

export default App;
