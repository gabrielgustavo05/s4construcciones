import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// ── Carga diferida de páginas (code-splitting por ruta) ──
const Login         = lazy(() => import('./pages/Login'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Obras         = lazy(() => import('./pages/Obras'));
const DptoElectrico = lazy(() => import('./pages/DptoElectrico'));
const ObraDetail    = lazy(() => import('./pages/ObraDetail'));
const Cotizaciones  = lazy(() => import('./pages/Cotizaciones'));
const Subcontratos  = lazy(() => import('./pages/Subcontratos'));
const Cronograma    = lazy(() => import('./pages/Cronograma'));
const EstadosPago   = lazy(() => import('./pages/EstadosPago'));
const FlujoCaja     = lazy(() => import('./pages/FlujoCaja'));
const Alertas       = lazy(() => import('./pages/Alertas'));
const Personal      = lazy(() => import('./pages/Personal'));
const Logistica     = lazy(() => import('./pages/Logistica'));
const Licitaciones  = lazy(() => import('./pages/Licitaciones'));

// Spinner compartido mientras carga cada módulo
const PageLoader = () => (
  <div className="loading-center" style={{ height: '60vh' }}>
    <div className="spinner" />
    Cargando...
  </div>
);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="loading-center" style={{ height: '100vh' }}>
      <div className="spinner" />
      Cargando...
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

            <Route path="/" element={
              <ProtectedRoute><Layout /></ProtectedRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"    element={<Dashboard />} />
              <Route path="obras"        element={<Obras />} />
              <Route path="electrico"    element={<DptoElectrico />} />
              <Route path="obra/:id"     element={<ObraDetail />} />
              <Route path="cotizaciones" element={<Cotizaciones />} />
              <Route path="subcontratos" element={<Subcontratos />} />
              <Route path="cronograma"   element={<Cronograma />} />
              <Route path="estados-pago" element={<EstadosPago />} />
              <Route path="flujo-caja"   element={<FlujoCaja />} />
              <Route path="alertas"      element={<Alertas />} />
              <Route path="personal"     element={<Personal />} />
              <Route path="logistica"    element={<Logistica />} />
              <Route path="licitaciones" element={<Licitaciones />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
