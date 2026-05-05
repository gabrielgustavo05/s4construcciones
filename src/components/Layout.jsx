import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const PAGE_TITLES = {
  '/dashboard':    'Dashboard',
  '/obras':        'Obras',
  '/cotizaciones': 'Cotizaciones',
  '/subcontratos': 'Subcontratos',
  '/cronograma':   'Cronograma',
  '/estados-pago': 'Estados de Pago',
  '/flujo-caja':   'Flujo de Caja',
  '/alertas':      'Alertas',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Para rutas de detalle como /obra/:id
  const title = PAGE_TITLES[location.pathname] || 'Constructora S4';

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="app-main">
        {/* Header móvil con hamburguesa */}
        <header className="mob-header">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <span className="mob-title">{title}</span>
        </header>

        {/* Contenido de la página actual */}
        <Outlet />
      </div>
    </div>
  );
}
