import { parseNum, today } from './helpers';

export const validateObraForm = (form) => {
  const errors = [];
  const nombre = (form.nombre || '').trim();
  const fechaInicio = form.fecha_inicio || null;
  const fechaFin = form.fecha_fin || null;
  const superficie = parseNum(form.superficie);

  if (!nombre) errors.push('El nombre de la obra es obligatorio.');
  if (nombre.length > 140) errors.push('El nombre de la obra es demasiado largo.');
  if (form.superficie !== '' && superficie < 0) errors.push('La superficie no puede ser negativa.');
  if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
    errors.push('La fecha de termino no puede ser anterior a la fecha de inicio.');
  }

  return errors;
};

export const validateCompraForm = (form) => {
  const errors = [];
  const descripcion = (form.descripcion || '').trim();
  const cantidad = parseNum(form.cantidad);
  const precioUnitario = parseNum(form.precio_unitario);
  const fecha = form.fecha || null;

  if (!descripcion) errors.push('La descripcion de la compra es obligatoria.');
  if (cantidad <= 0) errors.push('La cantidad debe ser mayor a cero.');
  if (precioUnitario < 0) errors.push('El precio unitario no puede ser negativo.');
  if (fecha && fecha > today()) errors.push('La fecha de compra no puede ser futura.');

  return errors;
};
