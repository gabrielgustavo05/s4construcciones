import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  ClipboardPaste,
  ClipboardPlus,
  DollarSign,
  FileText,
  HardHat,
  LogOut,
  ReceiptText,
  Truck,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  {
    section: 'Principal',
    items: [
      { to: '/dashboard', icon: BarChart3, label: 'Dashboard' },
      { to: '/obras', icon: BriefcaseBusiness, label: 'Obras' },
      { to: '/licitaciones', icon: ClipboardPlus, label: 'Licitaciones' },
      { to: '/electrico', icon: Zap, label: 'Dpto. Electrico' },
      { to: '/logistica', icon: Truck, label: 'Logistica' },
    ],
  },
  {
    section: 'Gestion tecnica',
    items: [
      { to: '/personal', icon: HardHat, label: 'Personal' },
      { to: '/cotizaciones', icon: ClipboardList, label: 'Cotizaciones' },
      { to: '/subcontratos', icon: FileText, label: 'Subcontratos' },
      { to: '/cronograma', icon: CalendarDays, label: 'Cronograma' },
    ],
  },
  {
    section: 'Finanzas',
    items: [
      { to: '/estados-pago', icon: ReceiptText, label: 'Estados de Pago' },
      { to: '/flujo-caja', icon: DollarSign, label: 'Flujo de Caja' },
      { to: '/pegar-contabilidad', icon: ClipboardPaste, label: 'Pegar Contabilidad' },
    ],
  },
  {
    section: 'Reportes',
    items: [
      { to: '/alertas', icon: AlertTriangle, label: 'Alertas' },
    ],
  },
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
      <div
        className={`mob-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sb-top">
          <div className="sb-brand">
            <div className="css-logo medium">
              <span className="logo-s">S</span>
              <span className="logo-4">4</span>
            </div>
            <div className="sb-brand-ver">CONTROL DE OBRAS v2.0</div>
          </div>
          <div className="sb-user">
            <div className="sb-avatar">{initials}</div>
            <div>
              <div className="sb-uname">{user?.email === 'fsalinas@s4chile.cl' ? 'Gerente General' : 'Jefatura'}</div>
              <div className="sb-urole">{user?.email}</div>
            </div>
          </div>
        </div>

        <nav className="sb-nav">
          {NAV.map(({ section, items }) => (
            <div className="nav-section" key={section}>
              <div className="nav-label">{section}</div>
              {items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <Icon className="nav-icon" size={16} strokeWidth={1.9} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sb-footer">
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={15} strokeWidth={1.9} />
            Cerrar sesion
          </button>
        </div>
      </aside>
    </>
  );
}
