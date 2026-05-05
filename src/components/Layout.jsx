import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, LogOut, Building2 } from 'lucide-react';

export default function Layout() {
  const { signOut, user } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-s4blue text-white flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-blue-800">
          <Building2 size={28} />
          <h1 className="text-xl font-bold">Constructora S4</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link
            to="/dashboard"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/obra')
                ? 'bg-blue-800 text-white'
                : 'text-blue-100 hover:bg-blue-800'
            }`}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
        </nav>

        <div className="p-4 border-t border-blue-800">
          <div className="mb-4 px-4 text-sm text-blue-200 truncate">
            {user?.email}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-2 w-full text-left text-blue-100 hover:bg-blue-800 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
