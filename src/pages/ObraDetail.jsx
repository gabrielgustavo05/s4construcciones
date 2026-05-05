import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Trash2, DollarSign } from 'lucide-react';

export default function ObraDetail() {
  const { id } = useParams();
  const [obra, setObra] = useState(null);
  const [activeTab, setActiveTab] = useState('presupuesto');
  const [items, setItems] = useState([]);
  const [loadingObra, setLoadingObra] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [newItem, setNewItem] = useState({
    descripcion: '',
    unidad: 'UN',
    cantidad: '',
    precio_unitario: ''
  });

  const fetchItems = useCallback(async (tab) => {
    const table = tab === 'presupuesto' ? 'presupuesto_items' : 'compras';
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('obra_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoadingItems(false);
    }
  }, [id]);

  useEffect(() => {
    const fetchObraData = async () => {
      try {
        const { data, error } = await supabase
          .from('obras')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        setObra(data);
      } catch (error) {
        console.error('Error fetching obra:', error);
      } finally {
        setLoadingObra(false);
      }
    };
    fetchObraData();
  }, [id]);

  useEffect(() => {
    fetchItems(activeTab);
  }, [activeTab, fetchItems]);

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
      fetchItems(activeTab);
    } catch (error) {
      console.error('Error adding item:', error);
      alert('Error al agregar el item');
    }
  };

  const deleteItem = async (itemId) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    const table = activeTab === 'presupuesto' ? 'presupuesto_items' : 'compras';
    try {
      const { error } = await supabase.from(table).delete().eq('id', itemId);
      if (error) throw error;
      fetchItems(activeTab);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  if (loadingObra) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700 mx-auto mb-4"></div>
          Cargando obra...
        </div>
      </div>
    );
  }

  if (!obra) {
    return (
      <div className="p-8 text-center text-red-500">
        Obra no encontrada.{' '}
        <Link to="/dashboard" className="underline text-blue-600">Volver</Link>
      </div>
    );
  }

  // Cálculos presupuesto
  const subtotalItems = items.reduce(
    (acc, item) => acc + Number(item.cantidad) * Number(item.precio_unitario), 0
  );
  const gastosGenerales = subtotalItems * 0.15;
  const utilidad = subtotalItems * 0.10;
  const neto = subtotalItems + gastosGenerales + utilidad;
  const iva = neto * 0.19;
  const totalPresupuesto = neto + iva;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link to="/dashboard" className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{obra.nombre}</h1>
          <p className="text-gray-400 text-sm mt-0.5">Detalle del proyecto</p>
        </div>
        <span className="ml-auto inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          {obra.estado}
        </span>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {['presupuesto', 'compras'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-sm font-semibold capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-[#1E3A8A] text-white'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {tab === 'presupuesto' ? '📋 Presupuesto' : '🛒 Compras'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Formulario */}
          <form
            onSubmit={handleAddItem}
            className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-6 grid grid-cols-12 gap-3 items-end"
          >
            <div className="col-span-12 md:col-span-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <input
                required
                type="text"
                value={newItem.descripcion}
                onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })}
                placeholder="Ej: Pintura látex"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
              <input
                required
                type="text"
                value={newItem.unidad}
                onChange={e => setNewItem({ ...newItem, unidad: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="col-span-4 md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={newItem.cantidad}
                onChange={e => setNewItem({ ...newItem, cantidad: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="col-span-4 md:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Precio Unitario</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={newItem.precio_unitario}
                onChange={e => setNewItem({ ...newItem, precio_unitario: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="col-span-12 md:col-span-1">
              <button
                type="submit"
                className="w-full bg-[#1E3A8A] text-white py-2 px-3 rounded-lg hover:bg-blue-800 transition-colors flex justify-center items-center"
              >
                <Plus size={20} />
              </button>
            </div>
          </form>

          {/* Tabla */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-4 py-3 w-10">N°</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Und</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">P. Unitario</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingItems ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-6 text-center text-gray-400">
                      Cargando...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                      No hay registros. Agrega el primer ítem arriba.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const total = Number(item.cantidad) * Number(item.precio_unitario);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-medium">{index + 1}</td>
                        <td className="px-4 py-3 text-gray-800">{item.descripcion}</td>
                        <td className="px-4 py-3 text-gray-500">{item.unidad}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{item.cantidad}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.precio_unitario)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(total)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Resumen financiero */}
          <div className="mt-6 flex justify-end">
            <div className="w-full md:w-72 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-[#1E3A8A] px-4 py-3 flex items-center gap-2">
                <DollarSign size={16} className="text-blue-200" />
                <span className="text-white text-sm font-semibold">
                  {activeTab === 'presupuesto' ? 'Resumen Presupuesto' : 'Total Compras'}
                </span>
              </div>
              <div className="p-4 space-y-2 text-sm">
                {activeTab === 'presupuesto' ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal items:</span>
                      <span>{formatCurrency(subtotalItems)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Gastos Generales (15%):</span>
                      <span>{formatCurrency(gastosGenerales)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Utilidad (10%):</span>
                      <span>{formatCurrency(utilidad)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500 border-t pt-2">
                      <span>Neto:</span>
                      <span>{formatCurrency(neto)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>IVA (19%):</span>
                      <span>{formatCurrency(iva)}</span>
                    </div>
                    <div className="flex justify-between text-[#1E3A8A] font-bold text-base border-t pt-3 mt-1">
                      <span>TOTAL FINAL:</span>
                      <span>{formatCurrency(totalPresupuesto)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between font-bold text-base text-gray-900">
                    <span>Total Compras:</span>
                    <span>{formatCurrency(subtotalItems)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
