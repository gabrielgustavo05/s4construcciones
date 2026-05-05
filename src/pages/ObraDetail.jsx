import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

export default function ObraDetail() {
  const { id } = useParams();
  const [obra, setObra] = useState(null);
  const [activeTab, setActiveTab] = useState('presupuesto'); // 'presupuesto' | 'compras'
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Nuevo item form
  const [newItem, setNewItem] = useState({
    descripcion: '',
    unidad: 'UN',
    cantidad: '',
    precio_unitario: ''
  });

  useEffect(() => {
    fetchObraData();
  }, [id]);

  useEffect(() => {
    if (obra) fetchItems();
  }, [activeTab, obra]);

  const fetchObraData = async () => {
    try {
      const { data, error } = await supabase.from('obras').select('*').eq('id', id).single();
      if (error) throw error;
      setObra(data);
    } catch (error) {
      console.error('Error fetching obra:', error);
    }
  };

  const fetchItems = async () => {
    const table = activeTab === 'presupuesto' ? 'presupuesto_items' : 'compras';
    try {
      const { data, error } = await supabase.from(table).select('*').eq('obra_id', id).order('created_at', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const table = activeTab === 'presupuesto' ? 'presupuesto_items' : 'compras';
    try {
      const { error } = await supabase.from(table).insert([{
        obra_id: id,
        descripcion: newItem.descripcion,
        unidad: newItem.unidad,
        cantidad: Number(newItem.cantidad),
        precio_unitario: Number(newItem.precio_unitario)
      }]);
      
      if (error) throw error;
      
      setNewItem({ descripcion: '', unidad: 'UN', cantidad: '', precio_unitario: '' });
      fetchItems();
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error al agregar el item');
    }
  };

  const deleteItem = async (itemId) => {
    const table = activeTab === 'presupuesto' ? 'presupuesto_items' : 'compras';
    try {
      const { error } = await supabase.from(table).delete().eq('id', itemId);
      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  if (!obra) return <div className="p-8">Cargando...</div>;

  // Cálculos
  const subtotalItems = items.reduce((acc, item) => acc + (Number(item.cantidad) * Number(item.precio_unitario)), 0);
  
  // Presupuesto calculations
  const gastosGenerales = activeTab === 'presupuesto' ? subtotalItems * 0.15 : 0;
  const utilidad = activeTab === 'presupuesto' ? subtotalItems * 0.10 : 0;
  const neto = subtotalItems + gastosGenerales + utilidad;
  const iva = neto * 0.19;
  const totalPresupuesto = neto + iva;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/dashboard" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{obra.nombre}</h1>
          <p className="text-gray-500 mt-1">Detalle del proyecto</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('presupuesto')}
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === 'presupuesto' ? 'bg-s4blue text-white' : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            Presupuesto
          </button>
          <button
            onClick={() => setActiveTab('compras')}
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === 'compras' ? 'bg-s4blue text-white' : 'hover:bg-gray-50 text-gray-600'
            }`}
          >
            Compras
          </button>
        </div>
        
        <div className="p-6">
          {/* Formulario nuevo item */}
          <form onSubmit={handleAddItem} className="bg-gray-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input required type="text" value={newItem.descripcion} onChange={e => setNewItem({...newItem, descripcion: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-s4blue" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
              <input required type="text" value={newItem.unidad} onChange={e => setNewItem({...newItem, unidad: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-s4blue" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input required type="number" step="0.01" value={newItem.cantidad} onChange={e => setNewItem({...newItem, cantidad: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-s4blue" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">P. Unitario</label>
              <input required type="number" step="0.01" value={newItem.precio_unitario} onChange={e => setNewItem({...newItem, precio_unitario: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-s4blue" />
            </div>
            <div className="md:col-span-1">
              <button type="submit" className="w-full bg-s4blue text-white py-2 rounded-lg hover:bg-blue-800 flex justify-center">
                <Plus size={24} />
              </button>
            </div>
          </form>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th className="px-6 py-3 rounded-tl-lg">N°</th>
                  <th className="px-6 py-3">Descripción</th>
                  <th className="px-6 py-3">Und</th>
                  <th className="px-6 py-3 text-right">Cantidad</th>
                  <th className="px-6 py-3 text-right">Precio Un.</th>
                  <th className="px-6 py-3 text-right">Total</th>
                  <th className="px-6 py-3 rounded-tr-lg"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const total = Number(item.cantidad) * Number(item.precio_unitario);
                  return (
                    <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{index + 1}</td>
                      <td className="px-6 py-4">{item.descripcion}</td>
                      <td className="px-6 py-4">{item.unidad}</td>
                      <td className="px-6 py-4 text-right">{item.cantidad}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(item.precio_unitario)}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(total)}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => deleteItem(item.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                      No hay registros aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Cálculos Finales */}
          <div className="mt-8 flex justify-end">
            <div className="w-full md:w-1/3 bg-gray-50 rounded-lg p-6 border border-gray-200">
              {activeTab === 'presupuesto' ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotalItems)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gastos Generales (15%):</span>
                    <span className="font-medium">{formatCurrency(gastosGenerales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Utilidad (10%):</span>
                    <span className="font-medium">{formatCurrency(utilidad)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="text-gray-600">Neto:</span>
                    <span className="font-medium">{formatCurrency(neto)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">IVA (19%):</span>
                    <span className="font-medium">{formatCurrency(iva)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-300 pt-3 text-lg font-bold text-s4blue">
                    <span>TOTAL FINAL:</span>
                    <span>{formatCurrency(totalPresupuesto)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total Compras:</span>
                    <span>{formatCurrency(subtotalItems)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
