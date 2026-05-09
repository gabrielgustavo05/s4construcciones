import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Obras from './pages/Obras';
import DptoElectrico from './pages/DptoElectrico';
import ObraDetail from './pages/ObraDetail';
import Cotizaciones from './pages/Cotizaciones';
import Subcontratos from './pages/Subcontratos';
import Cronograma from './pages/Cronograma';
import EstadosPago from './pages/EstadosPago';
import FlujoCaja from './pages/FlujoCaja';
import Alertas from './pages/Alertas';
import Personal from './pages/Personal';
import Logistica from './pages/Logistica';
import Licitaciones from './pages/Licitaciones';

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
      </BrowserRouter>
    </AuthProvider>
  );
}
