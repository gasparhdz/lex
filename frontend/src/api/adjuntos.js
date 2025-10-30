// src/api/adjuntos.js
import api from './axios';

export const crearCarpetaCliente = (clienteId) => {
  return api.post(`/drive/clientes/${clienteId}/create`);
};

export const vincularCarpetaCliente = (clienteId, driveFolderId) => {
  return api.put(`/drive/clientes/${clienteId}/vincular`, { driveFolderId });
};

export const crearCarpetaCaso = (casoId) => {
  return api.post(`/drive/casos/${casoId}/create`);
};

export const vincularCarpetaCaso = (casoId, driveFolderId, numeroDrive) => {
  return api.put(`/drive/casos/${casoId}/vincular`, { driveFolderId, numeroDrive });
};

export const uploadAdjunto = (formData) => {
  return api.post('/adjuntos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const listarAdjuntos = (scope, scopeId) => {
  return api.get('/adjuntos', {
    params: { scope, scopeId },
  });
};

export const indexarAdjuntos = (scope, scopeId) => {
  return api.get('/adjuntos/indexar', {
    params: { scope, scopeId },
  });
};

export const eliminarAdjunto = (adjuntoId) => {
  return api.delete(`/adjuntos/${adjuntoId}`);
};

