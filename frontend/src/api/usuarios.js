import api from './axios.js';

export const fetchUsuarios = (params = {}) => {
  return api.get('/usuarios', { params }).then((r) => r.data);
};

export const fetchUsuario = (id) => {
  return api.get(`/usuarios/${id}`).then((r) => r.data);
};

export const crearUsuario = (data) => {
  return api.post('/usuarios', data).then((r) => r.data);
};

export const actualizarUsuario = (id, data) => {
  return api.put(`/usuarios/${id}`, data).then((r) => r.data);
};

export const borrarUsuario = (id) => {
  return api.delete(`/usuarios/${id}`).then((r) => r.data);
};

export const fetchRoles = () => {
  return api.get('/usuarios/roles').then((r) => r.data);
};
