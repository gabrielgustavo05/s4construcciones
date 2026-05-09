export const LICITACION_ESTADOS = [
  'En estudio',
  'En cotizacion',
  'Lista para enviar',
  'Enviada',
  'Adjudicada',
  'Perdida',
  'Cerrada',
];

export const ESPECIALIDAD_ESTADOS = [
  'Pendiente de enviar',
  'Enviada a cotizar',
  'Cotizacion recibida',
  'No aplica',
];

export const ESPECIALIDADES = [
  { key: 'clima', label: 'CLIMA' },
  { key: 'incendio', label: 'INCENDIO' },
  { key: 'mobiliario', label: 'MOBILIARIO' },
];

export const LICITACION_FINALIZADA = ['Adjudicada', 'Perdida', 'Cerrada'];

export const emptyLicitacion = {
  nombre_licitacion: '',
  cliente: '',
  direccion: '',
  fecha_recepcion: '',
  fecha_entrega: '',
  responsable: '',
  estado: 'En estudio',
  observaciones: '',
  clima_estado: 'Pendiente de enviar',
  clima_fecha_envio: '',
  clima_fecha_recepcion: '',
  incendio_estado: 'Pendiente de enviar',
  incendio_fecha_envio: '',
  incendio_fecha_recepcion: '',
  mobiliario_estado: 'Pendiente de enviar',
  mobiliario_fecha_envio: '',
  mobiliario_fecha_recepcion: '',
};

export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date();
  const target = new Date(`${dateStr}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
};

export const getSpecialtyState = (licitacion, key) => licitacion[`${key}_estado`] || 'Pendiente de enviar';

export const isSpecialtyResolved = (estado) =>
  estado === 'Cotizacion recibida' || estado === 'No aplica';

export const getPendingSpecialties = (licitacion) =>
  ESPECIALIDADES.filter(({ key }) => {
    const estado = getSpecialtyState(licitacion, key);
    return estado !== 'No aplica' && !isSpecialtyResolved(estado);
  });

export const getLicitacionHealth = (licitacion) => {
  if (LICITACION_FINALIZADA.includes(licitacion.estado)) return 'closed';

  const pending = getPendingSpecialties(licitacion);
  const days = daysUntil(licitacion.fecha_entrega);

  if (pending.length === 0) return 'ready';
  if (days !== null && days < 3) return 'danger';
  return 'warning';
};

export const getHealthColor = (health) => {
  const map = {
    ready: 'var(--green)',
    warning: 'var(--orange)',
    danger: 'var(--red)',
    closed: 'var(--text3)',
  };
  return map[health] || 'var(--text3)';
};

export const getHealthLabel = (licitacion) => {
  const health = getLicitacionHealth(licitacion);
  const days = daysUntil(licitacion.fecha_entrega);
  const pending = getPendingSpecialties(licitacion);

  if (health === 'closed') return 'Finalizada';
  if (health === 'ready') return 'Lista';
  if (health === 'danger') return days < 0 ? 'Vencida con pendientes' : 'Riesgo por fecha';
  return `${pending.length} pendiente${pending.length === 1 ? '' : 's'}`;
};

export const specialtyToneClass = (estado) => {
  const map = {
    'Cotizacion recibida': 'spec-ok',
    'Enviada a cotizar': 'spec-wait',
    'Pendiente de enviar': 'spec-risk',
    'No aplica': 'spec-na',
  };
  return map[estado] || 'spec-na';
};

export const normalizeLicitacionPayload = (form) => {
  const payload = { ...form };

  ESPECIALIDADES.forEach(({ key }) => {
    if (payload[`${key}_estado`] === 'No aplica') {
      payload[`${key}_fecha_envio`] = null;
      payload[`${key}_fecha_recepcion`] = null;
    } else {
      payload[`${key}_fecha_envio`] = payload[`${key}_fecha_envio`] || null;
      payload[`${key}_fecha_recepcion`] = payload[`${key}_fecha_recepcion`] || null;
    }
  });

  payload.fecha_recepcion = payload.fecha_recepcion || null;
  payload.fecha_entrega = payload.fecha_entrega || null;
  return payload;
};
