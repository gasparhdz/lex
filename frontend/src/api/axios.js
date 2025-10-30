// src/api/axios.js
import axios from "axios";

const API_HOST = import.meta.env.VITE_API_HOST || "192.168.100.183";
const API_PORT = import.meta.env.VITE_API_PORT || 4000;

const api = axios.create({
  baseURL: `http://${API_HOST}:${API_PORT}/api`,
  // withCredentials: false, // mantener en false mientras no uses cookies httpOnly
});

/* ====== REQUEST ======
   Lee el token desde localStorage antes de cada request
*/
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ====== RESPONSE ======
   Si el token vence o el backend devuelve 401/419:
   - limpia storage
   - redirige a /login?next=currentPath
*/
let redirecting = false;

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;

    if ((status === 401 || status === 419) && !redirecting) {
      redirecting = true;
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } finally {
        const here = window.location.pathname + window.location.search;
        if (!window.location.pathname.startsWith("/login")) {
          window.location.replace(`/login?next=${encodeURIComponent(here)}`);
        }
      }
    }

    return Promise.reject(error);
  }
);

/* ====== Helpers ====== */
export function loginPersist(token) {
  if (token) localStorage.setItem("token", token);
}

export function logoutClear() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

/* Retrocompatibilidad */
export function setAuthToken(_token) {
  // ya no hace falta
}

export default api;
