// src/api/whatsapp.js
import api from './axios';

export const getWhatsAppStatus = () => {
  return api.get('/recordatorios/whatsapp-status');
};

