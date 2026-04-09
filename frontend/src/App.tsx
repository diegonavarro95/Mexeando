/**
 * src/App.tsx — FINAL (Fase 6)
 */
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from './store/authStore';
import { hasStoredTouristPersona } from './lib/touristPersona';
import PwaInstallPrompt from './components/pwa/PwaInstallPrompt';

import HomePage from './pages/public/HomePage';

// ── Auth ──────────────────────────────────────────────────────────────────────
import LanguagePage      from './pages/auth/LanguagePage';
import LoginPage         from './pages/auth/LoginPage';
import RegisterStep1Page from './pages/auth/RegisterStep1Page';
import RegisterStep2Page from './pages/auth/RegisterStep2Page'; // ← aquí

// ── Turista ───────────────────────────────────────────────────────────────────
import ExplorePage        from './pages/tourist/ExplorePage';
import BusinessDetailPage from './pages/tourist/BusinessDetailPage';
import PassportPage       from './pages/tourist/PassportPage';
import FeedPage           from './pages/tourist/FeedPage';
import ProfilePage        from './pages/tourist/ProfilePage';
import CheckinPage        from './pages/tourist/CheckinPage';
import ChatPage           from './pages/tourist/ChatPage';
import ChatBusinessPage           from './pages/tourist/ChatBusinessPage';
import TouristQuizPage    from './pages/tourist/TouristQuizPage';

// ── Owner 
import OnboardingPage from './pages/owner/OnboardingPage'; // guard interno removido
import EditPage       from './pages/owner/EditPage';
import DashboardPage  from './pages/owner/DashboardPage';
import QRPage         from './pages/owner/QRPage';

// ── Admin 
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ReviewPage         from './pages/admin/ReviewPage';
import AdminCreateBusinessPage from './pages/admin/AdminCreateBusinessPage';
import AdminDeleteBusinessPage from './pages/admin/AdminDeleteBusinessPage';
import AdminEditBusinessPage from './pages/admin/AdminEditBusinessPage';

// ─── Guards ───────────────────────────────────────────────────────────────────

const ROLE_HOME: Record<UserRole, string> = {
  tourist: '/explore',
  owner: '/owner/dashboard',
  admin: '/admin',
}

/**
 * PublicRoute — rutas sin sesión (login, register).
 * NO redirige owners — si userRole es 'owner' podría ser un owner
 * recién registrado navegando a /owner/onboarding. Solo redirigimos
 * tourist y admin que nunca pasan por el onboarding post-registro.
 */
function PublicRoute({ children }: { children: ReactNode }) {
  const { accessToken, userRole } = useAuthStore();
  if (accessToken && userRole === 'admin')   return <Navigate to="/admin"   replace />;
  if (accessToken && userRole === 'tourist') {
    return <Navigate to={hasStoredTouristPersona() ? '/explore' : '/tourist/quiz'} replace />;
  }
  // owner NO se redirige aquí — el navigate() del register ya lo llevó
  // a /owner/onboarding antes de que setAuth actualizara el store.
  return <>{children}</>;
}

/** Solo requiere token — no checa rol. Usado para onboarding post-registro. */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Requiere token + rol owner. Para rutas de owner post-onboarding. */
function OwnerRoute({ children }: { children: ReactNode }) {
  const { accessToken, userRole } = useAuthStore();
  if (!accessToken) return <Navigate to="/login"   replace />;
  if (userRole && userRole !== 'owner') return <Navigate to="/explore" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { accessToken, userRole } = useAuthStore();
  if (!accessToken) return <Navigate to="/login"   replace />;
  if (userRole && userRole !== 'admin') return <Navigate to="/explore" replace />;
  return <>{children}</>;
}

function TouristRoute({ children }: { children: ReactNode }) {
  const { accessToken, userRole } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;
  if (userRole && userRole !== 'tourist') return <Navigate to={ROLE_HOME[userRole]} replace />;
  if (!hasStoredTouristPersona()) return <Navigate to="/tourist/quiz" replace />;
  return <>{children}</>;
}

function TouristQuizRoute({ children }: { children: ReactNode }) {
  const { accessToken, userRole } = useAuthStore();
  if (!accessToken) return <Navigate to="/login" replace />;
  if (userRole && userRole !== 'tourist') return <Navigate to={ROLE_HOME[userRole]} replace />;
  if (hasStoredTouristPersona()) return <Navigate to="/explore" replace />;
  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────
function AppContent() {
  const { isAuthReady } = useAuthStore();
  const location = useLocation();
  const showInstallPrompt = location.pathname === '/';

  return (
    <>
      {showInstallPrompt && <PwaInstallPrompt />}
      {!isAuthReady ? (
        <div className="min-h-screen bg-bgDark flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-crema/20 border-t-rojo rounded-full animate-spin" />
            <p className="text-crema/50 text-sm">Cargando la Ruta...</p>
          </div>
        </div>
      ) : (
      <Routes>
        {/* Home pública */}
        <Route path="/" element={<HomePage />} />

        {/* Auth */}
        <Route path="/language" element={<LanguagePage />} />
        <Route path="/login"    element={<PublicRoute><LoginPage         /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterStep1Page /></PublicRoute>} />

        {/* Turista */}
        <Route path="/tourist/quiz"     element={<TouristQuizRoute><TouristQuizPage /></TouristQuizRoute>} />
        <Route path="/explore"          element={<TouristRoute><ExplorePage /></TouristRoute>} />
        <Route path="/business/:id"     element={<TouristRoute><BusinessDetailPage /></TouristRoute>} />
        <Route path="/passport"         element={<TouristRoute><PassportPage /></TouristRoute>} />
        <Route path="/feed"             element={<TouristRoute><FeedPage     /></TouristRoute>} />
        <Route path="/profile"          element={<TouristRoute><ProfilePage  /></TouristRoute>} />
        <Route path="/checkin"          element={<TouristRoute><CheckinPage  /></TouristRoute>} />
        <Route path="/chat/:businessId" element={<TouristRoute><ChatBusinessPage /></TouristRoute>} />
        <Route path="/chat"             element={<TouristRoute><ChatPage     /></TouristRoute>} />

        {/* Owner */}
        <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />

        {/*
          ProtectedRoute (no OwnerRoute) para evitar el race condition:
          navigate() corre antes de setAuth(), entonces cuando React monta
          esta ruta userRole todavía puede ser null — OwnerRoute lo rechazaría.
          ProtectedRoute solo checa el token, que sí existe (se guardó en
          localStorage antes del navigate).
        */}
        <Route path="/owner/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/register/step2" element={<OwnerRoute><RegisterStep2Page /></OwnerRoute>} />

        <Route path="/owner/edit"      element={<OwnerRoute><EditPage      /></OwnerRoute>} />
        <Route path="/owner/dashboard" element={<OwnerRoute><DashboardPage /></OwnerRoute>} />
        <Route path="/owner/qr"        element={<OwnerRoute><QRPage        /></OwnerRoute>} />

        {/* Admin */}
        <Route path="/admin"                    element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin/review/:businessId" element={<AdminRoute><ReviewPage        /></AdminRoute>} />
        <Route path="/admin/businesses/new"                 element={<AdminRoute><AdminCreateBusinessPage /></AdminRoute>} />
        <Route path="/admin/businesses/:businessId/edit"    element={<AdminRoute><AdminEditBusinessPage /></AdminRoute>} />
        <Route path="/admin/businesses/:businessId/delete"  element={<AdminRoute><AdminDeleteBusinessPage /></AdminRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
