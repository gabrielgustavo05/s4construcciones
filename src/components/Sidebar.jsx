import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { section: 'Principal', items: [
    { to: '/dashboard', icon: '📊', label: 'Dashboard' },
    { to: '/obras',     icon: '🏢', label: 'Obras' },
    { to: '/electrico', icon: '⚡', label: 'Dpto. Eléctrico' },
  ]},
  { section: 'Gestión técnica', items: [
    { to: '/cotizaciones', icon: '📋', label: 'Cotizaciones' },
    { to: '/subcontratos', icon: '👷', label: 'Subcontratos' },
    { to: '/cronograma',   icon: '📅', label: 'Cronograma' },
  ]},
  { section: 'Finanzas', items: [
    { to: '/estados-pago', icon: '💰', label: 'Estados de Pago' },
    { to: '/flujo-caja',   icon: '📈', label: 'Flujo de Caja' },
  ]},
  { section: 'Reportes', items: [
    { to: '/alertas', icon: '🔔', label: 'Alertas' },
  ]},
];

export default function Sidebar({ open, onClose }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'S4';

  return (
    <>
      {/* Overlay móvil */}
      <div
        className={`mob-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Marca */}
        <div className="sb-top">
          <div className="sb-brand">
            <div className="sb-brand-icon">🏗️</div>
            <div>
              <div className="sb-brand-name">Constructora S4</div>
              <div className="sb-brand-ver">Sistema de gestión v2.0</div>
            </div>
          </div>
          <div className="sb-user">
            <div className="sb-avatar">{initials}</div>
            <div>
              <div className="sb-uname">Jefatura</div>
              <div className="sb-urole">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="sb-nav">
          {NAV.map(({ section, items }) => (
            <div className="nav-section" key={section}>
              <div className="nav-label">{section}</div>
              {items.map(({ to, icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <span className="nav-icon">{icon}</span>
                  {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sb-footer">
          <button className="btn-logout" onClick={handleLogout}>
            ⬅ Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
