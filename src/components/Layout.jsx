import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/obras': 'Obras',
  '/cotizaciones': 'Cotizaciones',
  '/subcontratos': 'Subcontratos',
  '/cronograma': 'Cronograma',
  '/estados-pago': 'Estados de Pago',
  '/flujo-caja': 'Flujo de Caja',
  '/alertas': 'Alertas',
  '/personal': 'Personal',
  '/logistica': 'Logistica',
  '/electrico': 'Dpto. Electrico',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] || 'Constructora S4';

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="app-main">
        <header className="mob-header">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} strokeWidth={1.9} />
          </button>
          <span className="mob-title">{title}</span>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
