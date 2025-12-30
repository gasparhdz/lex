// src/routes/finanzas/index.js
import { Router } from "express";

// Rutas de finanzas (todas dentro de esta carpeta)
import honorarioRoutes from "./honorario.routes.js";
import ingresoRoutes from "./ingreso.routes.js";
import gastoRoutes from "./gasto.routes.js";
import finanzasResumenRoutes from "./finanzas-resumen.routes.js";
import finanzasReportesRoutes from "./finanzas-reportes.routes.js";
import planPagoRoutes from "./plan-pago.routes.js";

// Aplicaciones (orden: específicas primero para evitar shadowing)
import ingresoCuotaRoutes from "./ingreso-cuota.routes.js";
import ingresoGastoRoutes from "./ingreso-gasto.routes.js";

const r = Router();

// Core finanzas
r.use("/honorarios", honorarioRoutes);
r.use("/ingresos", ingresoRoutes);
r.use("/gastos", gastoRoutes);

// Planes de pago
r.use("/planes", planPagoRoutes);

// Aplicaciones (primero las rutas más específicas)
r.use("/aplicaciones/cuotas", ingresoCuotaRoutes);
r.use("/aplicaciones/gastos", ingresoGastoRoutes);

// Resúmenes y reportes
r.use("/resumen", finanzasResumenRoutes);
r.use("/reportes", finanzasReportesRoutes);

export default r;
