import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, Building2, TrendingUp, TrendingDown, Trash2, X } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newObraName, setNewObraName] = useState('');
  const [newObraEstado, setNewObraEstado] = useState('En Progreso');

  const fetchObras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select(`
          id,
          nombre,
          estado,
          presupuesto_items ( cantidad, precio_unitario ),
          compras ( cantidad, precio_unitario )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const obrasCalculated = data.map(obra => {
        const subtotalPresupuesto = obra.presupuesto_items.reduce(
          (acc, item) => acc + Number(item.cantidad) * Number(item.precio_unitario), 0
        );
        const gastos = subtotalPresupuesto * 0.15;
        const utilidad = subtotalPresupuesto * 0.10;
        const neto = subtotalPresupuesto + gastos + utilidad;
        const totalPresupuesto = neto * 1.19;

        const totalCompras = obra.compras.reduce(
          (acc, item) => acc + Number(item.cantidad) * Number(item.precio_unitario), 0
        );
        const diferencia = totalPresupuesto - totalCompras;

        return { ...obra, totalPresupuesto, totalCompras, diferencia };
      });

      setObras(obrasCalculated);
    } catch (error) {
      console.error('Error fetching obras:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchObras();
  }, [fetchObras]);

  const createObra = async (e) => {
    e.preventDefault();
    if (!newObraName.trim()) return;

    try {
      const { error } = await supabase
        .from('obras')
        .insert([{ nombre: newObraName, estado: newObraEstado, user_id: user.id }]);

      if (error) throw error;

      setNewObraName('');
      setNewObraEstado('En Progreso');
      setShowModal(false);
      fetchObras();
    } catch (error) {
      console.error('Error creating obra:', error);
      alert('Error al crear la obra: ' + error.message);
    }
  };

  const deleteObra = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('¿Seguro que deseas eliminar esta obra y todos sus datos?')) return;

    try {
      const { error } = await supabase.from('obras').delete().eq('id', id);
      if (error) throw error;
      fetchObras();
    } catch (error) {
      console.error('Error deleting obra:', error);
      alert('Error al eliminar la obra');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewObraName('');
    setNewObraEstado('En Progreso');
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mx-auto mb-4"></div>
          Cargando obras...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis Obras</h1>
          <p className="text-gray-400 text-sm mt-1">Gestión general de proyectos activos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#1E3A8A] hover:bg-blue-800 text-white px-4 py-2.5 rounded-lg shadow transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Nueva Obra
        </button>
      </div>

      {/* Grid de obras */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {obras.map((obra) => (
          <Link
            key={obra.id}
            to={`/obra/${obra.id}`}
            className="group block bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all overflow-hidden"
          >
            {/* Card Header */}
            <div className="bg-gradient-to-r from-[#1E3A8A] to-blue-700 px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Building2 size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white leading-tight truncate max-w-36" title={obra.nombre}>
                    {obra.nombre}
                  </h3>
                  <span className="text-blue-200 text-xs">{obra.estado}</span>
                </div>
              </div>
              <button
                onClick={(e) => deleteObra(e, obra.id)}
                className="p-1.5 text-blue-200 hover:text-red-300 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Card Body */}
            <div className="p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Presupuesto:</span>
                <span className="font-medium text-gray-900">{formatCurrency(obra.totalPresupuesto)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Gastado:</span>
                <span className="font-medium text-gray-900">{formatCurrency(obra.totalCompras)}</span>
              </div>

              <div className={`flex items-center justify-between rounded-lg px-3 py-2 mt-2 ${
                obra.diferencia >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <span className="text-xs font-medium text-gray-500">Resultado</span>
                <div className={`flex items-center gap-1 font-bold text-sm ${
                  obra.diferencia >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {obra.diferencia >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  {formatCurrency(obra.diferencia)}
                </div>
              </div>
            </div>
          </Link>
        ))}

        {obras.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-xl">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No hay obras registradas</h3>
            <p className="text-gray-400 text-sm mt-1">Crea tu primer proyecto haciendo clic en "Nueva Obra".</p>
          </div>
        )}
      </div>

      {/* Modal Nueva Obra */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">Crear Nueva Obra</h2>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={createObra} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la obra <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newObraName}
                  onChange={(e) => setNewObraName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm"
                  placeholder="Ej: Remodelación Local Centro"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={newObraEstado}
                  onChange={(e) => setNewObraEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm bg-white"
                >
                  <option>En Progreso</option>
                  <option>Planificación</option>
                  <option>Pausada</option>
                  <option>Finalizada</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-[#1E3A8A] text-white rounded-lg hover:bg-blue-800 transition-colors font-medium"
                >
                  Crear Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
