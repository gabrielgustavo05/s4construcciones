import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Plus, Building, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newObraName, setNewObraName] = useState('');

  useEffect(() => {
    fetchObras();
  }, []);

  const fetchObras = async () => {
    try {
      // Fetch obras with their related items for calculations
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

      // Calculate totals
      const obrasCalculated = data.map(obra => {
        // Presupuesto total: (cantidad * precio) + Gastos(15%) + Utilidad(10%) + IVA(19%)
        // Note: For simplicity on dashboard, we can just do raw total or apply the formula
        const subtotalPresupuesto = obra.presupuesto_items.reduce((acc, item) => acc + (Number(item.cantidad) * Number(item.precio_unitario)), 0);
        const gastos = subtotalPresupuesto * 0.15;
        const utilidad = subtotalPresupuesto * 0.10;
        const neto = subtotalPresupuesto + gastos + utilidad;
        const totalPresupuesto = neto * 1.19;

        const totalCompras = obra.compras.reduce((acc, item) => acc + (Number(item.cantidad) * Number(item.precio_unitario)), 0);
        const diferencia = totalPresupuesto - totalCompras;

        return {
          ...obra,
          totalPresupuesto,
          totalCompras,
          diferencia
        };
      });

      setObras(obrasCalculated);
    } catch (error) {
      console.error('Error fetching obras:', error);
    } finally {
      setLoading(false);
    }
  };

  const createObra = async (e) => {
    e.preventDefault();
    if (!newObraName.trim()) return;

    try {
      const { error } = await supabase
        .from('obras')
        .insert([{ nombre: newObraName, user_id: user.id }]);

      if (error) throw error;
      
      setNewObraName('');
      setShowModal(false);
      fetchObras();
    } catch (error) {
      console.error('Error creating obra:', error);
      alert('Error al crear la obra');
    }
  };

  const deleteObra = async (e, id) => {
    e.preventDefault();
    if (!window.confirm('¿Estás seguro de eliminar esta obra? Se eliminarán todos sus datos asociados.')) return;

    try {
      const { error } = await supabase
        .from('obras')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchObras();
    } catch (error) {
      console.error('Error deleting obra:', error);
      alert('Error al eliminar la obra');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando obras...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mis Obras</h1>
          <p className="text-gray-500 mt-1">Gestión general de proyectos activos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-s4blue hover:bg-blue-800 text-white px-4 py-2 rounded-lg shadow-sm transition-colors"
        >
          <Plus size={20} />
          Nueva Obra
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {obras.map((obra) => (
          <Link
            key={obra.id}
            to={`/obra/${obra.id}`}
            className="block bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 text-s4blue rounded-lg">
                    <Building size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 truncate" title={obra.nombre}>{obra.nombre}</h3>
                    <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full mt-1">
                      {obra.estado}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={(e) => deleteObra(e, obra.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="space-y-3 mt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Presupuesto:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(obra.totalPresupuesto)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Gastado:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(obra.totalCompras)}</span>
                </div>
                
                <div className="pt-3 mt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">Resultado:</span>
                  <div className={`flex items-center gap-1 font-bold ${obra.diferencia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {obra.diferencia >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {formatCurrency(obra.diferencia)}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}

        {obras.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-300 rounded-xl">
            <Building size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No hay obras registradas</h3>
            <p className="text-gray-500 mt-1">Comienza creando tu primer proyecto.</p>
          </div>
        )}
      </div>

      {/* Modal Nueva Obra */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Crear Nueva Obra</h2>
            <form onSubmit={createObra}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la obra</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newObraName}
                  onChange={(e) => setNewObraName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-s4blue"
                  placeholder="Ej: Remodelación Local Centro"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-s4blue text-white rounded-lg hover:bg-blue-800 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
