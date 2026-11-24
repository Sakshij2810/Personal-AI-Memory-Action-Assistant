import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Toaster } from "sonner";

import Home from "./views/Home/Home";
import Dashboard from "./views/Dashboard/Dashboard";
import UploadImages from "./views/MediaUploads/UploadImages";
import ImageGallery from "./views/Storage/ImageGallery";
import { REACT_APP_NAV_ROUTES } from "./Router/AppNavigation";
import { useCurrentUser } from "./hooks/useAuth";
import PageLayout from "./Layouts/PageLayout";
import PeopleRecognition from "./views/PeopleRecognition/PeopleRecognition";
import PersonGallery from "./views/People/PersonGallery";
import PeopleDirectory from "./views/People/PeopleDirectory";

// ---------------------------- PersonGallery Route ----------------------------
function PersonGalleryRoute() {
  const { personId } = useParams();
  const navigate = useNavigate();

  if (!personId) {
    return <Navigate to="/people" replace />;
  }

  return (
    <PersonGallery personId={personId} onBack={() => navigate("/people")} />
  );
}

// ---------------------------- App Route ----------------------------

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const { data, isPending, isError } = useCurrentUser();

  // Our API response contains { user: ... }
  const user = data?.user ?? null;

  if (isError && location.pathname !== "/") {
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
          {/* ------------------- People Recognition ------------------- */}
          <Route
            path={REACT_APP_NAV_ROUTES.people_recognition}
            element={<PeopleRecognition />}
          />

          {/* ------------------- People Directory ------------------- */}
          <Route
            path={REACT_APP_NAV_ROUTES.people_directory}
            element={
              <PeopleDirectory
                onSelectPerson={(personId) => {
                  navigate(`/people/${personId}`);
                }}
              />
            }
          />

          {/* ------------------- Person Gallery Route ------------------- */}
          <Route path="/people/:personId" element={<PersonGalleryRoute />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
