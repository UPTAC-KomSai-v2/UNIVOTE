import { useEffect } from "react";
import LoginPage from "./pages/LoginPage/LoginPage";
import VoterDashboard from "./pages/VoterDashboard/VoterDashboard";
import VoterVotePage from "./pages/VoterVotePage/VoterVotePage.jsx";
import VoterReceiptPage from "./pages/VoterReceiptPage/VoterReceiptPage.jsx";
import CandidateDashboard from "./pages/CandidateDashboard/CandidateDashboard";
import CandidateManageProfilePage from "./pages/CandidateManageProfilePage/CandidateManageProfilePage";
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard";
import AuditorDashboard from "./pages/AuditorDashboard/AuditorDashboard";
import UnauthorizedPage from "./pages/UnauthorizedPage/UnauthorizedPage";
import NotFoundPage from "./pages/NotFoundPage/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import RedirectIfAuthenticated from "./components/RedirectIfAuthenticated/RedirectIfAuthenticated";
import { AUTH_LOGOUT_EVENT } from "./api";
import './App.css'

import {
  BrowserRouter as Router,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";

function AuthLogoutListener() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => {
      if (location.pathname.startsWith("/login")) return;
      navigate("/login", { replace: true });
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, handler);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handler);
  }, [navigate, location.pathname]);

  return null;
}

function App() {
  return (
    <>
      <Router>
        <AuthLogoutListener />
        <Routes>
          {/* Public Routes */}
          <Route
            path="/"
            element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <LoginPage />
              </RedirectIfAuthenticated>
            }
          />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Voter Routes */}
          <Route
            path="/voter-dashboard"
            element={
              <ProtectedRoute allowedRoles={["voter"]}>
                <VoterDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voter-vote"
            element={
              <ProtectedRoute allowedRoles={["voter", "candidate"]}>
                <VoterVotePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voter-receipt"
            element={
              <ProtectedRoute allowedRoles={["voter", "candidate"]}>
                <VoterReceiptPage />
              </ProtectedRoute>
            }
          />

          {/* Candidate Routes */}
          <Route
            path="/candidate-dashboard"
            element={
              <ProtectedRoute allowedRoles={["candidate"]}>
                <CandidateDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate-profile"
            element={
              <ProtectedRoute allowedRoles={["candidate"]}>
                <CandidateManageProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Auditor Routes */}
          <Route
            path="/auditor-dashboard"
            element={
              <ProtectedRoute allowedRoles={["auditor"]}>
                <AuditorDashboard />
              </ProtectedRoute>
            }
          />

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFoundPage />} />

        </Routes>
      </Router>
    </>
  )
}

export default App
