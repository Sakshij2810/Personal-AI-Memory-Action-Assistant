import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import Home from "./views/Home/Home";
import Dashboard from "./views/Dashboard/Dashboard";
import UploadImages from "./views/MediaUploads/UploadImages";
import ImageGallery from "./views/Storage/ImageGallery";
import { REACT_APP_NAV_ROUTES } from "./Router/AppNavigation";
import { useCurrentUser } from "./hooks/useUser";
import PageLayout from "./Layouts/PageLayout";

function App() {
  const { data, isPending, isError } = useCurrentUser();

  // Our API response contains { user: ... }
  const user = data?.user ?? null;

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-red-500">
          Unable to verify your session. Please refresh the page.
        </p>
      </div>
    );
  }

  if (isPending) {
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
        {/* Public route */}
        {/* ------------------- Home ------------------- */}
        <Route
          path="/"
          element={
            user ? (
              <Navigate to={REACT_APP_NAV_ROUTES.dashboard} replace />
            ) : (
              <Home />
            )
          }
        />

        {/* Shared authenticated layout */}

        <Route
          element={
            user ? <PageLayout user={user} /> : <Navigate to="/" replace />
          }
        >
          {/* ------------------- Dashboard ------------------- */}
          <Route
            path={REACT_APP_NAV_ROUTES.dashboard}
            element={<Dashboard user={user!} />}
          />
          {/* ------------------- Media Uploads ------------------- */}
          <Route
            path={REACT_APP_NAV_ROUTES.upload_images}
            element={<UploadImages />}
          />
          {/* ------------------- Storage ------------------- */}
          <Route
            path={REACT_APP_NAV_ROUTES.image_gallery}
            element={<ImageGallery />}
          />
        </Route>
      </Routes>
    </>
  );
}

export default App;
