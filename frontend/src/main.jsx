// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";
import { ThemeModeProvider } from "./theme/ThemeModeProvider";
import "@fullcalendar/common/main.css";
// Auth & layout
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import Layout from "./layout/Layout";

// Páginas principales
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Usuarios from "./pages/Usuarios";
import UsuarioForm from "./pages/UsuarioForm";
import Clientes from "./pages/Clientes";
import ClienteForm from "./pages/ClienteForm";
import ClienteDetalle from "./pages/ClienteDetalle";
import Casos from "./pages/Casos";
import CasoForm from "./pages/CasoForm";
import CasoDetalle from "./pages/CasoDetalle";
import Agenda from "./pages/Agenda";
import Eventos from "./pages/Eventos";
import EventoForm from "./pages/EventoForm";
import Tareas from "./pages/Tareas";
import TareaForm from "./pages/TareaForm";
import Finanzas from "./pages/Finanzas";
import Honorarios from "./pages/Honorarios";
import HonorarioForm from "./pages/HonorarioForm";
import Gastos from "./pages/Gastos";
import GastoForm from "./pages/GastoForm";
import Ingresos from "./pages/Ingresos";
import IngresoForm from "./pages/IngresoForm";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";

// Reportes
import Reportes from "./pages/Reportes";
import HonorariosPendientes from "./pages/reportes/HonorariosPendientes";
import GastosPendientes from "./pages/reportes/GastosPendientes";
import VencimientosPorPeriodo from "./pages/reportes/VencimientosPorPeriodo";
import IngresosReporte from "./pages/reportes/Ingresos";

// Páginas adicionales
import Configuracion from "./pages/Configuracion";
import ParametroForm from "./pages/ParametroForm";
import ValorJUSForm from "./pages/ValorJUSForm";
import PaisForm from "./pages/PaisForm";
import ProvinciaForm from "./pages/ProvinciaForm";
import LocalidadForm from "./pages/LocalidadForm";
import CodigoPostalForm from "./pages/CodigoPostalForm";
import RolForm from "./pages/RolForm";

// ===== Placeholders =====
function Adjuntos() {
  return <div>Adjuntos</div>;
}

// ===== QueryClient =====
const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ThemeModeProvider>
          <SnackbarProvider
            maxSnack={3}
            autoHideDuration={3000}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <BrowserRouter basename="/lex">
                <Routes>
                  {/* ===== Rutas públicas ===== */}
                  <Route path="/login" element={<Login />} />

                  {/* ===== Rutas protegidas ===== */}
                  <Route
                    element={
                      <RequireAuth>
                        <Layout />
                      </RequireAuth>
                    }
                  >
                    {/* Dashboard */}
                    <Route index element={<Dashboard />} />

                    {/* ==== USUARIOS ==== */}
                    <Route path="usuarios" element={<Usuarios />} />
                    <Route path="usuarios/nuevo" element={<UsuarioForm />} />
                    <Route path="usuarios/editar/:id" element={<UsuarioForm />} />

                    {/* ==== CLIENTES ==== */}
                    <Route path="clientes" element={<Clientes />} />
                    <Route path="clientes/nuevo" element={<ClienteForm />} />
                    <Route path="clientes/editar/:id" element={<ClienteForm />} />
                    <Route path="clientes/:id" element={<ClienteDetalle />} />

                    {/* ==== CASOS ==== */}
                    <Route path="casos" element={<Casos />} />
                    <Route path="casos/nuevo" element={<CasoForm />} />
                    <Route path="casos/editar/:id" element={<CasoForm />} />
                    <Route path="casos/:id" element={<CasoDetalle />} />

                    {/* ==== TAREAS ==== */}
                    <Route path="tareas" element={<Tareas />} />
                    <Route path="tareas/nuevo" element={<TareaForm />} />
                    <Route path="tareas/editar/:id" element={<TareaForm />} />

                    {/* ==== EVENTOS ==== */}
                    <Route path="eventos" element={<Eventos />} />
                    <Route path="eventos/nuevo" element={<EventoForm />} />
                    <Route path="eventos/editar/:id" element={<EventoForm />} />

                    {/* ==== FINANZAS ==== */}
                    <Route path="finanzas" element={<Finanzas />} />

                    {/* Honorarios */}
                    <Route path="finanzas/honorarios" element={<Honorarios />} />
                    <Route path="finanzas/honorarios/nuevo" element={<HonorarioForm />} />
                    <Route path="finanzas/honorarios/editar/:id" element={<HonorarioForm />} />
                    <Route path="finanzas/honorarios/:id" element={<HonorarioForm />} />

                    {/* Gastos */}
                    <Route path="finanzas/gastos" element={<Gastos />} />
                    <Route path="finanzas/gastos/nuevo" element={<GastoForm />} />
                    <Route path="finanzas/gastos/editar/:id" element={<GastoForm />} />
                    {/* 👉 Detalle usa la misma pantalla con modo "ver" */}
                    <Route path="finanzas/gastos/:id" element={<GastoForm />} />

                    {/* Ingresos */}
                    <Route path="finanzas/ingresos" element={<Ingresos />} />
                    <Route path="finanzas/ingresos/nuevo" element={<IngresoForm />} />
                    <Route path="finanzas/ingresos/editar/:id" element={<IngresoForm />} />
                    <Route path="finanzas/ingresos/:id" element={<IngresoForm />} />

                    {/* ==== Otras ==== */}
                    <Route path="agenda" element={<Agenda />} />
                    <Route path="adjuntos" element={<Adjuntos />} />
                    
                    {/* ==== REPORTES ==== */}
                    <Route path="reportes" element={<Reportes />} />
                    <Route path="reportes/honorarios-pendientes" element={<HonorariosPendientes />} />
                    <Route path="reportes/gastos-pendientes" element={<GastosPendientes />} />
                    <Route path="reportes/vencimientos-periodo" element={<VencimientosPorPeriodo />} />
                    <Route path="reportes/ingresos" element={<IngresosReporte />} />
                    
                    {/* ==== CONFIGURACIÓN ==== */}
                    <Route path="configuracion" element={<Configuracion />} />
                    <Route path="configuracion/parametros/nuevo" element={<ParametroForm />} />
                    <Route path="configuracion/parametros/editar/:id" element={<ParametroForm />} />
                    
                    {/* Tablas virtuales */}
                    <Route path="configuracion/pais/nuevo" element={<PaisForm />} />
                    <Route path="configuracion/pais/editar/:id" element={<PaisForm />} />
                    <Route path="configuracion/provincia/nuevo" element={<ProvinciaForm />} />
                    <Route path="configuracion/provincia/editar/:id" element={<ProvinciaForm />} />
                    <Route path="configuracion/localidad/nuevo" element={<LocalidadForm />} />
                    <Route path="configuracion/localidad/editar/:id" element={<LocalidadForm />} />
                    <Route path="configuracion/codigo_postal/nuevo" element={<CodigoPostalForm />} />
                    <Route path="configuracion/codigo_postal/editar/:id" element={<CodigoPostalForm />} />
                    <Route path="configuracion/valor_jus/nuevo" element={<ValorJUSForm />} />
                    <Route path="configuracion/valor_jus/editar/:id" element={<ValorJUSForm />} />
                    <Route path="configuracion/roles/nuevo" element={<RolForm />} />
                    <Route path="configuracion/roles/editar/:id" element={<RolForm />} />
                  </Route>

                  {/* ===== Fallback ===== */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </LocalizationProvider>
          </SnackbarProvider>
        </ThemeModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
