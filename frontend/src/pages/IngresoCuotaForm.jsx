// src/pages/IngresoCuotaForm.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box, IconButton, Typography,
  Table, TableRow, TableCell, TableBody, TableHead,
  Checkbox, Collapse, Chip, LinearProgress
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";

import { listHonorarios, getHonorario } from "../api/finanzas/honorarios";
import { listAplicacionesCuota } from "../api/finanzas/ingreso-cuota";
import { formatCurrency, toDMYLocal  } from "../utils/format";
import api from "../api/axios";

/* ===== helpers ===== */
const idKey = (v) => String(v ?? "");
const isValidId = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

// IDs de políticas JUS
const ID_POLI_FECHA_REG = 168; // A fecha regulación
const ID_POLI_ACTUAL = 169;    // AL_COBRO

// Obtener valor JUS por fecha
async function getValorJusPorFecha(fechaISO) {
  if (!fechaISO) return null;
  try {
    const { data } = await api.get("/valorjus", {
      params: { from: fechaISO, to: fechaISO, page: 1, pageSize: 1 },
    });
    const rows = data?.data || [];
    const match = rows.find((v) => v.fecha === fechaISO || v.fecha?.startsWith(fechaISO));
    return match?.valor ? Number(match.valor) : null;
  } catch {
    return null;
  }
}

const displayCliente = (c) => {
  if (!c) return "";
  const rs = (c.razonSocial || "").trim();
  if (rs) return rs;
  const a = (c.apellido || "").trim();
  const n = (c.nombre || "").trim();
  return [a, n].filter(Boolean).join(", ") || `#${c.id}`;
};
function computeMontoARS(c, vjGlobal) {
  // Para cuotas en JUS, SIEMPRE recalcular usando valorJusRef si existe (cuota ya pagada parcialmente),
  // sino usar vjGlobal (valor JUS del ingreso nuevo). NO confiar en c.montoARS del backend para cuotas en JUS.
  const jus = Number(c.jus ?? c.montoJus ?? c.cantidadJus ?? 0);
  if (jus > 0) {
    // Priorizar valorJusRef de la cuota si existe (cuota ya pagada parcialmente)
    // Si no tiene valorJusRef, usar vjGlobal (valor JUS del ingreso nuevo) para cuotas pendientes
    // IMPORTANTE: Si vjGlobal es null/undefined, no podemos calcular correctamente, pero intentamos con valorJusRef si existe
    let vj = 0;
    if (Number(c.valorJusRef ?? 0) > 0) {
      vj = Number(c.valorJusRef);
    } else if (vjGlobal != null && Number.isFinite(vjGlobal) && vjGlobal > 0) {
      vj = Number(vjGlobal);
    }
    
    if (vj > 0 && jus > 0) {
      return Math.round(jus * vj * 100) / 100;
    }
    // Si no tenemos valor JUS válido, retornar 0 (no usar c.montoARS del backend para JUS)
    return 0;
  }
  
  // Para cuotas en pesos, usar el montoARS del backend
  const ars = Number(c.montoARS ?? c.montoPesos ?? c.monto ?? 0);
  return ars > 0 ? ars : 0;
}

// Calcular monto ARS según política JUS (para cuotas pendientes)
function computeMontoARSConPolitica(c, vjSegunPolitica, politicaJusId) {
  const jus = Number(c.jus ?? c.montoJus ?? c.cantidadJus ?? 0);
  if (jus > 0 && vjSegunPolitica != null && Number.isFinite(vjSegunPolitica) && vjSegunPolitica > 0) {
    return Math.round(jus * vjSegunPolitica * 100) / 100;
  }
  return 0;
}
function efectivoSaldoARS(c, vjGlobal) {
    // Si la cuota está en JUS, SIEMPRE recalcular usando valorJusRef si existe (cuota ya pagada parcialmente),
    // sino usar vjGlobal (valor JUS del ingreso nuevo). NO confiar en c.saldoARS del backend para cuotas en JUS.
    const isJus = Number(c.montoJus ?? c.jus ?? 0) > 0;
    if (isJus) {
      const montoJus = Number(c.montoJus ?? c.jus ?? 0);
      const aplicadoJUS = Number(c.aplicadoJUS ?? 0);
      const saldoJUS = montoJus - aplicadoJUS;
      
      // Priorizar valorJusRef de la cuota si existe (cuota ya pagada con un ingreso anterior)
      // Si no tiene valorJusRef, usar vjGlobal (valor JUS del ingreso nuevo) para cuotas pendientes
      // IMPORTANTE: Si vjGlobal es null/undefined, no podemos calcular correctamente, pero intentamos con valorJusRef si existe
      let vjParaUsar = 0;
      if (Number(c.valorJusRef ?? 0) > 0) {
        vjParaUsar = Number(c.valorJusRef);
      } else if (vjGlobal != null && Number.isFinite(vjGlobal) && vjGlobal > 0) {
        vjParaUsar = Number(vjGlobal);
      }
      
      if (vjParaUsar > 0 && saldoJUS > 0) {
        // SIEMPRE recalcular el saldo en ARS usando el valor JUS correcto
        const saldoARS = saldoJUS * vjParaUsar;
        return Math.max(Math.round(saldoARS * 100) / 100, 0);
      }
      return 0;
    }
    
    // Para cuotas en pesos, usar el saldoARS del backend si existe
    const provided = c.saldoARS ?? c.saldo;
    if (Number.isFinite(Number(provided))) return Number(provided);
    
    // Si no hay saldoARS del backend, calcularlo
    const ars = computeMontoARS(c, vjGlobal);
    const aplicado = Number(c.aplicadoARS ?? c.montoAplicadoARS ?? c.aplicado ?? 0) || 0;
    return Math.max(Math.round((ars - aplicado) * 100) / 100, 0);
  }

// Calcular saldo ARS según política JUS (para cuotas pendientes o parcialmente pagadas)
function efectivoSaldoARSConPolitica(c, vjSegunPolitica, politicaJusId) {
  const isJus = Number(c.montoJus ?? c.jus ?? 0) > 0;
  if (isJus) {
    const montoJus = Number(c.montoJus ?? c.jus ?? 0);
    const aplicadoJUS = Number(c.aplicadoJUS ?? 0);
    const saldoJUS = montoJus - aplicadoJUS;
    
    // Para cuotas pendientes, usar el valor JUS según la política
    if (vjSegunPolitica != null && Number.isFinite(vjSegunPolitica) && vjSegunPolitica > 0 && saldoJUS > 0) {
      const saldoARS = saldoJUS * vjSegunPolitica;
      return Math.max(Math.round(saldoARS * 100) / 100, 0);
    }
    return 0;
  }
  
  // Para cuotas en pesos, usar el saldoARS del backend si existe
  const provided = c.saldoARS ?? c.saldo;
  if (Number.isFinite(Number(provided))) return Number(provided);
  
  // Si no hay saldoARS del backend, calcularlo
  const ars = computeMontoARSConPolitica(c, vjSegunPolitica, politicaJusId);
  const aplicado = Number(c.aplicadoARS ?? c.montoAplicadoARS ?? c.aplicado ?? 0) || 0;
  return Math.max(Math.round((ars - aplicado) * 100) / 100, 0);
}
  const formatMontoCuotaCell = (c) => {
    const jus = Number(c.jus ?? c.montoJus ?? 0);
    
    // Si la cuota está en JUS, usar montoARS ya recalculado en enrichedCuotas
    if (jus > 0) {
      // Usar montoARS directamente de la cuota enriquecida (ya tiene el valor correcto según política)
      const ars = Number(c.montoARS || 0);
      const jusTxt = Number.isInteger(jus) ? String(jus) : jus.toFixed(2);
      if (ars > 0) {
        return `${jusTxt} JUS (${formatCurrency(ars, "ARS")})`;
      }
      // Si no tenemos monto válido, mostrar solo JUS sin monto
      return `${jusTxt} JUS (—)`;
    }
    
    // Para cuotas en pesos, usar el montoARS
    const ars = Number(c.montoARS || 0);
    return formatCurrency(ars, "ARS");
  };

/* ===== estilo de checkbox ===== */
const checkboxSx = (t) => {
  const sx = {};
  if (t.palette.mode === "dark") {
    sx["&.Mui-checked:not(.Mui-disabled)"] = { color: t.palette.secondary.main };
  } else {
    sx["&.Mui-disabled"] = { color: t.palette.action.disabled };
    sx["&.Mui-disabled.Mui-checked"] = { color: t.palette.action.disabled };
  }
  return sx;
};

/* ===== cuotas por honorario ===== */
function useHonorarioCuotas(honorarioId) {
  return useQuery({
    queryKey: ["hon-cuotas", honorarioId],
    enabled: !!honorarioId,
    queryFn: async () => {
      const raw = await getHonorario(honorarioId);
      const hon = raw?.data?.data ?? raw?.data ?? raw;
      const plan = (Array.isArray(hon?.planes) ? hon.planes : [])
        .find((p) => Array.isArray(p?.cuotas) && p.cuotas.length) || null;
      const cuotasSrc = plan?.cuotas || [];
      const vjHoy = Number(cuotasSrc?.[0]?.valorJusHoy || 0) || null;

      // Obtener política JUS del plan y fecha de regulación del honorario
      const politicaJusId = plan?.politicaJusId || null;
      const fechaRegulacion = hon?.fechaRegulacion || null;

      // ⛔ No inventamos IDs; descartamos cuotas sin id numérico válido
      const mapped = cuotasSrc
        .map((c) => {
          const cid = Number(c.id);
          if (!isValidId(cid)) return null;
          const isJus = Number(c.montoJus || 0) > 0 && !(Number(c.montoPesos || 0) > 0);
          const vj = Number(c.valorJusRef || vjHoy || 0) || 0;
          const ars = isJus ? Number(c.montoJus || 0) * vj : Number(c.montoPesos || 0);
          const aplicadoARS = Number(c.aplicadoARS || 0);
          const aplicadoJUS = Number(c.aplicadoJUS || 0);
          const montoJus = Number(c.montoJus || 0);
          const saldoARS = Number.isFinite(Number(c.saldoARS))
            ? Number(c.saldoARS)
            : Math.max(Math.round(ars * 100) / 100 - aplicadoARS, 0);

          // Obtener aplicaciones de la cuota (para cuotas pagadas)
          const aplicaciones = Array.isArray(c.aplicaciones) ? c.aplicaciones : [];

          return {
            id: cid,
            numero: c.numero ?? c.nroCuota ?? c.nro ?? undefined,
            vencimiento: c.vencimiento ?? null,
            montoARS: Math.round(ars * 100) / 100,
            jus: isJus ? Number(c.montoJus || 0) : null,
            montoJus: isJus ? montoJus : null,
            valorJusRef: vj || null,
            aplicadoARS,
            aplicadoJUS,
            saldoARS,
            aplicaciones, // Aplicaciones de IngresoCuota para esta cuota
            estado:
              (typeof c.estado === "object"
                ? (c.estado?.nombre || c.estado?.codigo)
                : c.estado) ?? null,
            isPagada:
              Boolean(c.isPagada) ||
              String(c?.estado?.nombre || c?.estado || "")
                .toUpperCase()
                .includes("PAGAD"),
          };
        })
        .filter(Boolean);

      return {
        cuotas: mapped,
        politicaJusId,
        fechaRegulacion,
      };
    },
  });
}

/* ===== honorarios pendientes ===== */
async function searchHonorarios({ clienteId, casoId }) {
  const { rows } = await listHonorarios({
    page: 0, pageSize: 500,
    clienteId: clienteId ? Number(clienteId) : undefined,
    casoId: casoId ? Number(casoId) : undefined,
    conPendiente: true,
  });
  return rows;
}

/* ===== aplicaciones de un ingreso ===== */
async function fetchAplicacionesPorIngreso(ingresoId) {
  const { rows } = await listAplicacionesCuota({ ingresoId: Number(ingresoId), pageSize: 100 });
  return rows;
}

/* =================================================================== */
export default function IngresoCuotaForm({
  clienteId,
  casoId,
  valorJusNum,
  ingresoId,          // edición
  restanteARS,        // saldo global disponible (informativo, puede estar desactualizado)
  ingresoARS,         // total del ingreso (para calcular disponible correctamente)
  totalSelGasARS,     // total seleccionado en gastos (para calcular disponible correctamente)
  value = [],
  onChange,
  onUserEdit = () => {}, // avisa al padre que hubo interacción de usuario
  viewOnly = false,
  noFrame = false, 
}) {
  const [open, setOpen] = useState({}); // { honId: bool }

  const { data: honList = [], isFetching } = useQuery({
    queryKey: ["hon-tree", clienteId, casoId],
    queryFn: () => searchHonorarios({ clienteId, casoId }),
    enabled: !!clienteId,
    staleTime: 30_000,
  });

  const { data: apps = [], isFetching: appsLoading } = useQuery({
    queryKey: ["apps-por-ingreso", ingresoId],
    enabled: !!ingresoId,
    queryFn: () => fetchAplicacionesPorIngreso(ingresoId),
    staleTime: 15_000,
  });

  // 🔰 Agrupo aplicaciones por honorario, con ids de cuota y montos aplicados (para modo ver)
  const appsByHon = useMemo(() => {
    const m = new Map();
    for (const r of apps || []) {
      const hidRaw = r?.cuota?.honorarioId ?? r?.honorarioId;
      const cidRaw = r?.cuota?.id;
      if (!isValidId(hidRaw) || !isValidId(cidRaw)) continue;
      const hid = idKey(hidRaw);
      const cid = idKey(cidRaw);
      if (!m.has(hid)) m.set(hid, { set: new Set(), amount: {} });
      const g = m.get(hid);
      g.set.add(cid);
      g.amount[cid] = (g.amount[cid] || 0) + Number(r?.montoAplicadoARS ?? r?.monto ?? 0);
    }
    return m;
  }, [apps]);

  const honIdsFromApps = useMemo(() => Array.from(appsByHon.keys()), [appsByHon]);

  // En modo VER: mostrará solo los honorarios que aparecen en las apps (con fallback mínimo)
  const honListEffective = useMemo(() => {
    if (!(viewOnly && ingresoId)) return honList;
    const byId = new Map((honList || []).map(h => [idKey(h.id), h]));
    return honIdsFromApps.map(hid => byId.get(hid) || { id: Number(hid), cliente: null, caso: null });
  }, [viewOnly, ingresoId, honList, honIdsFromApps]);

  const rowByHonId = useMemo(() => {
  const map = new Map();
  for (const r of value) {
    const hid = idKey(r?.honorario?.id ?? r?.honorarioId);
    if (hid) map.set(hid, r);
  }
  return map;
}, [value]);

  const upsertRow = useCallback(
    (hon, patch) => {
      const hid = idKey(hon.id);
      const current = rowByHonId.get(hid);
      if (current) {
        // ✅ Asegurar que se creen nuevos objetos para que React detecte el cambio
        const next = value.map((r) => {
          if (idKey(r?.honorario?.id ?? r?.honorarioId) === hid) {
            // Crear nuevos objetos para selectedCuotas y appliedHereById si están en el patch
            const updated = { ...r };
            if (patch.selectedCuotas !== undefined) {
              updated.selectedCuotas = { ...patch.selectedCuotas };
            }
            if (patch.appliedHereById !== undefined) {
              updated.appliedHereById = { ...patch.appliedHereById };
            }
            // Aplicar otros campos del patch
            Object.keys(patch).forEach(key => {
              if (key !== 'selectedCuotas' && key !== 'appliedHereById') {
                updated[key] = patch[key];
              }
            });
            return updated;
          }
          return r;
        });
        onChange?.(next);
      } else {
        onChange?.([
          ...value,
          {
            honorarioId: Number(hon.id),
            honorario: hon,
            selectedCuotas: patch.selectedCuotas ? { ...patch.selectedCuotas } : {},
            selectedNumMap: {},
            appliedHereById: patch.appliedHereById ? { ...patch.appliedHereById } : {},
            appliedHereByNum: {},
            cuotasResolved: [],
            ...Object.fromEntries(
              Object.entries(patch).filter(([k]) => k !== 'selectedCuotas' && k !== 'appliedHereById')
            ),
          },
        ]);
      }
    },
    [value, onChange, rowByHonId]
  );

  const setSelectedForHon = useCallback(
    (hon, nextSelectedMap) => {
      if (viewOnly) return;                 // 👈 no cambiar nada en modo ver
      upsertRow(hon, { selectedCuotas: nextSelectedMap });
    },
    [upsertRow, viewOnly]
  );

  const setAppliedForHon = useCallback(
    (hon, nextAppliedMap) => {
      if (viewOnly) return;
      upsertRow(hon, { appliedHereById: nextAppliedMap });
    },
    [upsertRow, viewOnly]
  );

  // Función para actualizar ambos estados a la vez (evita condiciones de carrera)
  const setBothForHon = useCallback(
    (hon, nextSelectedMap, nextAppliedMap) => {
      if (viewOnly) return;
      upsertRow(hon, { selectedCuotas: nextSelectedMap, appliedHereById: nextAppliedMap });
    },
    [upsertRow, viewOnly]
  );

  const setCuotasResolved = useCallback(
    (hon, cuotas) => {
      if (viewOnly) return; // 👈 en modo ver no persistimos en el padre
      upsertRow(hon, { cuotasResolved: cuotas });
    },
    [upsertRow, viewOnly]
  );

  // Precarga (edición): marcar checks del propio ingreso
  useEffect(() => {
    if (!ingresoId || !apps?.length) return;
    // Si no hay lista base (p.ej. sin cliente en modo ver), igual intentamos aplicar sobre los que tengamos
    const baseList = (viewOnly ? honListEffective : honList) || [];
    if (!baseList.length) return;

    const byHon = new Map();
    for (const r of apps) {
      const hid = idKey(r?.cuota?.honorarioId ?? r?.honorarioId ?? "");
      const cidRaw = r?.cuota?.id;
      if (!hid || !isValidId(cidRaw)) continue;
      const cid = idKey(cidRaw);
      if (!byHon.has(hid)) byHon.set(hid, { selectedCuotas: {}, appliedHereById: {} });
      const g = byHon.get(hid);
      g.selectedCuotas[cid] = true; // marcamos pero NO disparamos onUserEdit aquí
      g.appliedHereById[cid] = (g.appliedHereById[cid] || 0) + Number(r?.montoAplicadoARS ?? r?.monto ?? 0);
    }

    // En modo ver preferimos NO llamar upsertRow (el padre puede ignorarlo), pero si existe onChange no molesta
    if (!viewOnly) {
      for (const hon of baseList) {
        const g = byHon.get(idKey(hon.id));
        if (g) upsertRow(hon, g);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingresoId, honList, honListEffective, apps, viewOnly]);

  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {(isFetching || appsLoading) && <LinearProgress />}

      <Table
        size="small"
        sx={{
          border: noFrame ? "none" : (t) => `1px solid ${t.palette.divider}`,
          borderRadius: noFrame ? 0 : 1,
          overflow: "hidden",
          "& .hon-main > td": { py: 0.5 },
        }}
      >
        <TableBody>
         {(honListEffective || []).map((h) => {
            const hid = idKey(h.id);
            // 🔰 rowState base desde el padre (si existe)
            let rowState = rowByHonId.get(hid);
            // 🔰 en modo ver, si no hay rowState del padre, armamos fallback con lo aplicado en apps
            if (viewOnly && !rowState) {
              const appsInfo = appsByHon.get(hid) || { set: new Set(), amount: {} };
              rowState = {
                selectedCuotas: {},
                appliedHereById: appsInfo.amount, // montos aplicados por cuota de ESTE ingreso
                cuotasResolved: [],               // en modo ver se tomarán directo desde la query de cuotas
              };
            }

            const totalEstimado =
              Number(h.montoPesos) > 0
                ? Number(h.montoPesos)
                : Number(h.jus) && Number(h.valorJusRef)
                ? Number(h.jus) * Number(h.valorJusRef)
                : 0;

            const opened = viewOnly ? true : !!open[hid];

            const canToggle = (c) => {
              if (!isValidId(c?.id)) return false; // ⛔ nunca toggle sin ID real
              const cid = idKey(c.id);
              const appliedHere = Number(rowState?.appliedHereById?.[cid] || 0);
              const saldoEff = efectivoSaldoARS(c, valorJusNum);
              return appliedHere > 0 || saldoEff > 0.01;
            };
            const eligibles = (rowState?.cuotasResolved || []).filter(canToggle);
            const selectedCount = (() => {
              // si ya tenemos cuotasResolved, usamos tu lógica actual
              const cr = rowState?.cuotasResolved || [];
              if (cr.length) {
                return cr.filter(
                  (c) => isValidId(c?.id) && !!rowState?.selectedCuotas?.[idKey(c.id)] && canToggle(c)
                ).length;
              }

              // fallback sin expandir:
              // - si hay selectedCuotas, contá esas
              const sel = rowState?.selectedCuotas || {};
              const selCount = Object.values(sel).filter(Boolean).length;
              if (selCount) return selCount;

              // - o si hay appliedHereById (apps precargadas), contá esas
              const app = rowState?.appliedHereById || {};
              return Object.keys(app).length;
            })();

            return (
              <FragmentRow
                key={hid}
                open={opened}
                header={
                  <TableRow
                    hover
                    className="hon-main"
                    sx={{
                      backgroundColor: (t) =>
                        t.palette.mode === "dark"
                          ? alpha(t.palette.primary.main, 0.4)
                          : alpha(t.palette.primary.main, 0.1),
                      "& td": {
                        borderBottom: (t) => `1px solid ${t.palette.divider}`,
                      },
                    }}
                  >
                    <TableCell padding="checkbox" sx={{ width: 44 }}>
                      <IconButton
                        size="small"
                        disabled={viewOnly}
                        onClick={() => {
                          if (viewOnly) return;
                          setOpen((o) => ({ ...o, [hid]: !o[hid] }));
                        }}
                        aria-label="Expandir honorario"
                      >
                        {opened ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                      </IconButton>
                    </TableCell>

                    <TableCell>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: (t) =>
                              t.palette.mode === "dark"
                                ? t.palette.grey[100]
                                : t.palette.grey[900],
                          }}
                        >
                          {displayCliente(h.cliente)}
                          {h.caso?.nroExpte ? ` — Expte ${h.caso.nroExpte}` : ""}
                        </Typography>
                        <Chip
                          size="small"
                          label={
                            viewOnly
                              ? "Cuotas aplicadas"
                              : `${selectedCount} cuota${selectedCount === 1 ? "" : "s"} seleccionadas`
                          }
                        />
                      </Box>
                    </TableCell>

                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {formatCurrency(totalEstimado, "ARS")}
                      </Typography>
                    </TableCell>
                  </TableRow>
                }
                                                                   detail={
                    <HonorarioDetail
                      honorario={h}
                      valorJusNum={valorJusNum}
                      restanteARS={restanteARS}
                      ingresoARS={ingresoARS}
                      totalSelGasARS={totalSelGasARS}
                      appsHonNew={value}
                      rowState={rowState}
                      setSelectedForHon={(m) => setSelectedForHon(h, m)}
                      setAppliedForHon={(m) => setAppliedForHon(h, m)}
                      setBothForHon={(sel, app) => setBothForHon(h, sel, app)}
                      setCuotasResolved={(cuotas) => setCuotasResolved(h, cuotas)}
                      onUserEdit={onUserEdit}
                      viewOnly={viewOnly}
                    />
                  }
              />
            );
          })}

          {(!viewOnly && honList.length === 0 && !isFetching) && (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 2 }}>
                {clienteId ? "Sin honorarios pendientes para este cliente/caso." : "Seleccioná un cliente."}
              </TableCell>
            </TableRow>
          )}

          {(viewOnly && (!apps || apps.length === 0) && !appsLoading) && (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 2 }}>
                Este ingreso no tiene aplicaciones registradas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

/* ---------- Fila expandible ---------- */
function FragmentRow({ header, detail, open }) {
  return (
    <>
      {header}
      {open && (
        <TableRow>
          <TableCell colSpan={3} sx={{ p: 0, border: 0 }}>
            <Collapse in timeout="auto" appear unmountOnExit={false}>
              {detail}
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ---------- Detalle de cuotas ---------- */
function HonorarioDetail({
  honorario,
  valorJusNum,
  restanteARS,
  ingresoARS,
  totalSelGasARS,
  appsHonNew,
  rowState,
  setSelectedForHon,
  setAppliedForHon,
  setBothForHon,
  setCuotasResolved,
  onUserEdit = () => {},
  viewOnly = false,
}) {
  const { data: honorarioData, isFetching } = useHonorarioCuotas(honorario.id);
  
  // Extraer datos del honorario
  const cuotas = honorarioData?.cuotas || [];
  const politicaJusId = honorarioData?.politicaJusId || null;
  const fechaRegulacion = honorarioData?.fechaRegulacion || null;

  // Obtener valor JUS a la fecha de regulación (si es necesario)
  const fechaRegISO = fechaRegulacion 
    ? (typeof fechaRegulacion === 'string' 
        ? fechaRegulacion.split('T')[0] 
        : new Date(fechaRegulacion).toISOString().split('T')[0])
    : null;

  const { data: valorJusFechaReg } = useQuery({
    queryKey: ["valor-jus-fecha-reg", fechaRegISO],
    queryFn: () => getValorJusPorFecha(fechaRegISO),
    enabled: Boolean(fechaRegISO && politicaJusId === ID_POLI_FECHA_REG),
    staleTime: 5 * 60 * 1000,
  });

  // Determinar valor JUS a usar según política
  const valorJusParaCuota = useMemo(() => {
    if (politicaJusId === ID_POLI_ACTUAL) {
      // AL_COBRO: usar valor JUS del ingreso actual
      return valorJusNum;
    } else if (politicaJusId === ID_POLI_FECHA_REG) {
      // FECHA_REGULACION: usar valor JUS a la fecha de regulación
      return valorJusFechaReg;
    }
    // Por defecto, usar valor JUS del ingreso actual
    return valorJusNum;
  }, [politicaJusId, valorJusNum, valorJusFechaReg]);

  // Enriquecemos cuotas SIEMPRE; solo persistimos en el padre cuando no es modo ver
  const enrichedCuotas = useMemo(() => {
    return (cuotas || [])
      .filter((c) => isValidId(c?.id))
      .map((c) => {
        // Para cuotas en JUS, aplicar la lógica según política y estado de pago
        // Para cuotas en pesos, usar c.montoARS del backend si existe
        const isJus = Number(c.jus ?? c.montoJus ?? 0) > 0;
        
        let ars = 0;
        let saldo = 0;
        
        if (isJus) {
          // Verificar si la cuota está pagada completamente
          const montoJus = Number(c.montoJus ?? c.jus ?? 0);
          const aplicadoJUS = Number(c.aplicadoJUS ?? 0);
          const isCompletamentePagada = aplicadoJUS >= montoJus && montoJus > 0;
          
          if (isCompletamentePagada && c.aplicaciones && c.aplicaciones.length > 0) {
            // Cuota pagada: usar datos de las aplicaciones (IngresoCuota)
            // Para el monto, calcular usando el valorJusAlAplic de la primera aplicación (o el más reciente)
            // Si no hay valorJusAlAplic, usar valorJusRef de la cuota
            const aplicacionMasReciente = c.aplicaciones
              .sort((a, b) => new Date(b.fechaAplicacion || 0) - new Date(a.fechaAplicacion || 0))[0];
            
            // Intentar obtener el valor JUS usado al pagar desde las aplicaciones
            let vjParaMonto = null;
            for (const app of c.aplicaciones) {
              if (app.valorJusAlAplic != null && Number(app.valorJusAlAplic) > 0) {
                vjParaMonto = Number(app.valorJusAlAplic);
                break; // Usar el primero que encontremos
              }
            }
            
            // Si no hay valorJusAlAplic, usar valorJusRef de la cuota
            if (!vjParaMonto && Number(c.valorJusRef ?? 0) > 0) {
              vjParaMonto = Number(c.valorJusRef);
            }
            
            // Si tenemos valor JUS, calcular el monto total de la cuota
            if (vjParaMonto && montoJus > 0) {
              ars = Math.round(montoJus * vjParaMonto * 100) / 100;
            } else {
              // Fallback: usar el total aplicado (suma de todas las aplicaciones)
              const totalAplicadoARS = c.aplicaciones.reduce((sum, app) => 
                sum + Number(app.montoAplicadoARS ?? 0), 0);
              ars = totalAplicadoARS > 0 ? totalAplicadoARS : computeMontoARS(c, valorJusParaCuota);
            }
            
            // Para el saldo, si está completamente pagada, saldo = 0
            saldo = 0;
          } else {
            // Cuota pendiente o parcialmente pagada: calcular según política JUS
            // IMPORTANTE: Si la cuota tiene aplicaciones previas, usar valorJusRef para calcular el total
            // para mantener consistencia con el cálculo original
            let vjParaTotal = valorJusParaCuota;
            if (c.aplicaciones && c.aplicaciones.length > 0) {
              // Si hay aplicaciones previas, intentar usar el valorJusRef de la cuota
              // o el valorJusAlAplic de las aplicaciones para calcular el total
              let vjDeAplicaciones = null;
              for (const app of c.aplicaciones) {
                if (app.valorJusAlAplic != null && Number(app.valorJusAlAplic) > 0) {
                  vjDeAplicaciones = Number(app.valorJusAlAplic);
                  break;
                }
              }
              if (vjDeAplicaciones) {
                vjParaTotal = vjDeAplicaciones;
              } else if (Number(c.valorJusRef ?? 0) > 0) {
                vjParaTotal = Number(c.valorJusRef);
              }
            }
            
            // Calcular el total usando el valor JUS correcto
            const montoJus = Number(c.montoJus ?? c.jus ?? 0);
            if (montoJus > 0 && vjParaTotal > 0) {
              ars = Math.round(montoJus * vjParaTotal * 100) / 100;
            } else {
              ars = computeMontoARSConPolitica(c, valorJusParaCuota, politicaJusId);
            }
            
            const aplicado = Number(c.aplicadoARS ?? 0);
            // Calcular el saldo: total - aplicado
            saldo = Math.max(Math.round((ars - aplicado) * 100) / 100, 0);
          }
        } else {
          // Para cuotas en pesos, usar valores del backend
          ars = Number(c.montoARS ?? 0) || 0;
          const aplicado = Number(c.aplicadoARS ?? 0);
          saldo = Number(c.saldoARS ?? 0) || Math.max(ars - aplicado, 0);
        }
        
        return { ...c, montoARS: ars, aplicadoARS: Number(c.aplicadoARS ?? 0), saldoARS: saldo };
      });
  }, [cuotas, valorJusParaCuota, politicaJusId]);

  useEffect(() => {
    if (viewOnly) return; // ⛔ en modo ver no intentamos guardar en el padre
    const prev = rowState?.cuotasResolved || [];
    let changed = prev.length !== enrichedCuotas.length;
    if (!changed) {
      for (let i = 0; i < enrichedCuotas.length; i++) {
        const a = enrichedCuotas[i], b = prev[i];
        if (!b ||
            a.id !== b.id ||
            a.montoARS !== b.montoARS ||
            a.aplicadoARS !== b.aplicadoARS ||
            a.saldoARS !== b.saldoARS ||
            !!a.isPagada !== !!b.isPagada) {
          changed = true; break;
        }
      }
    }
    if (changed) setCuotasResolved(enrichedCuotas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedCuotas, viewOnly]);

  const selectedMap = rowState?.selectedCuotas || {};
  const epsilon = 0.01;

  // canToggle debe usar las cuotas enriquecidas (que tienen valores recalculados)
  const canToggle = useCallback((c) => {
    if (!isValidId(c?.id)) return false;
    const cid = idKey(c.id);
    const appliedHere = Number(rowState?.appliedHereById?.[cid] || 0);
    // Usar la cuota enriquecida directamente (ya tiene saldoARS recalculado)
    const saldoEff = c.saldoARS ?? efectivoSaldoARS(c, valorJusNum);
    return appliedHere > 0 || saldoEff > epsilon;
  }, [rowState, valorJusNum]);

  // 🔰 SIEMPRE usar enrichedCuotas para render (tienen los valores recalculados correctamente)
  // rowState?.cuotasResolved puede estar desactualizado o tener valores calculados con otro valor JUS
  const allRows = enrichedCuotas;
  const eligibles = allRows.filter(canToggle);

  const appliedSet = useMemo(
    () => new Set(Object.keys(rowState?.appliedHereById || {})),
    [rowState]
  );

  const rowsToRender = viewOnly ? allRows.filter(c => appliedSet.has(idKey(c.id))) : allRows;

  const totalEleg = viewOnly ? rowsToRender.length : eligibles.length;
  const selectedCount = viewOnly
    ? rowsToRender.length
    : allRows.filter(
        (c) => isValidId(c?.id) && !!selectedMap[idKey(c.id)] && canToggle(c)
      ).length;

  const orderByVtoNum = (arr) =>
    [...arr].sort((a, b) => {
      const da = a.vencimiento ? new Date(a.vencimiento).getTime() : 0;
      const db = b.vencimiento ? new Date(b.vencimiento).getTime() : 0;
      if (da !== db) return da - db;
      return Number(a.numero || 0) - Number(b.numero || 0);
    });

  // Calcular el disponible para este honorario específico
  // Considera el ingreso total, menos gastos, menos lo seleccionado en otros honorarios, menos lo ya seleccionado en este honorario
  const calcularDisponibleParaEsteHonorario = useCallback((excluirCuotaId = null) => {
    const ingresoTotal = Number(ingresoARS || 0);
    const gastosSeleccionados = Number(totalSelGasARS || 0);
    
    // Calcular lo seleccionado en otros honorarios (excluyendo este)
    let totalOtrosHonorarios = 0;
    // Calcular lo ya seleccionado en este honorario (puede excluir una cuota específica)
    let totalEsteHonorario = 0;
    
    for (const item of appsHonNew || []) {
      if (idKey(item?.honorario?.id) === idKey(honorario.id)) {
        // Este es el honorario actual
        const sel = item?.selectedCuotas || {};
        const appliedById = item?.appliedHereById || {};
        for (const c of item?.cuotasResolved || []) {
          const cid = idKey(c.id);
          if (excluirCuotaId && cid === idKey(excluirCuotaId)) {
            continue; // Excluir esta cuota del cálculo
          }
          if (sel[cid]) {
            const montoAplicado = Number(appliedById[cid] || 0);
            if (montoAplicado > 0) {
              totalEsteHonorario += montoAplicado;
            } else {
              const saldo = Number(c?.saldoARS || 0);
              totalEsteHonorario += saldo;
            }
          }
        }
      } else {
        // Otro honorario, sumar todo lo seleccionado
        const sel = item?.selectedCuotas || {};
        const appliedById = item?.appliedHereById || {};
        for (const c of item?.cuotasResolved || []) {
          if (sel[String(c.id)]) {
            const cid = String(c.id);
            const montoAplicado = Number(appliedById[cid] || 0);
            if (montoAplicado > 0) {
              totalOtrosHonorarios += montoAplicado;
            } else {
              const saldo = Number(c?.saldoARS || 0);
              totalOtrosHonorarios += saldo;
            }
          }
        }
      }
    }
    
    // Disponible = ingreso total - gastos - otros honorarios - este honorario (ya seleccionado)
    const disponible = Math.max(ingresoTotal - gastosSeleccionados - totalOtrosHonorarios - totalEsteHonorario, 0);
    
    return disponible;
  }, [ingresoARS, totalSelGasARS, appsHonNew, honorario.id]);

  return (
    <Box sx={{ px:0, pb: 0 }}>
      {isFetching && <LinearProgress sx={{ mb: 1 }} />}
      <Table
        size="small"
        sx={{
          width: '100%',
          borderLeft: 0,
          borderRight: 0,
          borderRadius: 0,
          border: (t) => `1px solid ${t.palette.divider}`,
          "& td, & th": { py: 0.5 },
        }}
      >
        <TableHead>
          <TableRow
            sx={{
              backgroundColor: (t) =>
                t.palette.mode === "dark"
                  ? alpha(t.palette.grey[600], 0.2)
                  : t.palette.grey[100],
            }}
          >
            <TableCell padding="checkbox">
              <Checkbox
                size="small"
                color="primary"
                sx={(t) => checkboxSx(t)}
                indeterminate={selectedCount > 0 && selectedCount < totalEleg}
                checked={totalEleg > 0 && selectedCount === totalEleg}
                disabled={viewOnly || (selectedCount === 0 && calcularDisponibleParaEsteHonorario() <= epsilon)}
                                 onChange={(e) => {
                   if (viewOnly) return; // 👈
                   const wantCheckAll = e.target.checked;
                   onUserEdit();
                   
                   const next = { ...selectedMap };
                   const nextApplied = { ...(rowState?.appliedHereById || {}) };
                   
                                        if (!wantCheckAll) {
                       // Deseleccionar todas: limpiar selección y montos aplicados
                       for (const c of eligibles) {
                         const cid = idKey(c.id);
                         delete next[cid];
                         delete nextApplied[cid];
                       }
                       // Actualizar ambos estados EN UNA SOLA LLAMADA
                       if (setBothForHon) {
                         setBothForHon(next, nextApplied);
                       } else {
                         setSelectedForHon(next);
                         setAppliedForHon(nextApplied);
                       }
                       return;
                     }
                     
                                                                                       // Seleccionar todas: marcar y aplicar según disponibilidad
                       // Calcular el disponible inicial para este honorario (sin contar las cuotas que vamos a seleccionar)
                       let restanteDisponible = calcularDisponibleParaEsteHonorario();
                       
                       for (const c of orderByVtoNum(eligibles)) {
                         const cid = idKey(c.id);
                         const saldoC = c.saldoARS ?? efectivoSaldoARS(c, valorJusNum);
                         const isCompletamentePagada = c.isPagada || saldoC <= epsilon;
                         
                         next[cid] = true;
                         
                         // Aplicar según disponibilidad: el mínimo entre el saldo de la cuota y el restante disponible
                         if (!isCompletamentePagada && saldoC > epsilon && restanteDisponible > epsilon) {
                           const montoAAplicar = Math.min(saldoC, restanteDisponible);
                           nextApplied[cid] = Math.round(montoAAplicar * 100) / 100;
                           restanteDisponible = Math.max(restanteDisponible - montoAAplicar, 0);
                         }
                         // Si ya está pagada, no tiene saldo, o no hay disponible, no aplicar monto (solo marcar selección)
                       }
                      // Actualizar ambos estados EN UNA SOLA LLAMADA
                      if (setBothForHon) {
                        setBothForHon(next, nextApplied);
                      } else {
                        setSelectedForHon(next);
                        setAppliedForHon(nextApplied);
                      }
                 }}
              />
            </TableCell>
                         <TableCell sx={{ fontWeight: 700 }}>N°</TableCell>
             <TableCell sx={{ fontWeight: 700 }}>Vto</TableCell>
             <TableCell align="right" sx={{ fontWeight: 700 }}>Monto cuota</TableCell>
             <TableCell align="right" sx={{ fontWeight: 700 }}>Aplicado ($)</TableCell>
             <TableCell align="right" sx={{ fontWeight: 700 }}>Saldo ($)</TableCell>
             <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
                                           {rowsToRender.map((c) => {
             if (!isValidId(c?.id)) return null; // ⛔ no render sin ID válido
             const cid = idKey(c.id);
             // Usar saldoARS de la cuota enriquecida directamente (ya tiene el valor recalculado correctamente)
             // Solo recalcular si no existe (por si acaso)
                           const saldoEff = c.saldoARS ?? efectivoSaldoARS(c, valorJusNum);
              const appliedHere = Number(rowState?.appliedHereById?.[cid] || 0);
              const fullyPaid = c.isPagada || saldoEff <= epsilon;
              const isSelected = !!selectedMap[cid];

                            // Calcular disponible para esta cuota (excluyendo esta cuota del cálculo)
               const disponibleParaEstaCuota = calcularDisponibleParaEsteHonorario(c.id);

               // Lógica de disabled y checked:
               // 1. Si está pagada completamente: siempre deshabilitada y siempre tildada
               // 2. Si está pendiente: deshabilitada solo si NO está seleccionada Y no hay disponible
               const disabled = fullyPaid || (!isSelected && disponibleParaEstaCuota <= epsilon);

               // Lógica de visualChecked:
               // 1. Si está pagada completamente: siempre tildada
               // 2. Si está pendiente: tildada solo si está seleccionada
               const visualChecked = viewOnly 
                 ? appliedHere > 0 
                 : fullyPaid ? true : (!!selectedMap[cid] && selectedMap[cid] === true);

            return (
              <TableRow key={cid} hover>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    color="primary"
                    sx={(t) => checkboxSx(t)}
                    checked={visualChecked}
                    disabled={viewOnly || disabled}
                    onChange={(e) => {
                        if (viewOnly || fullyPaid) return; // No permitir cambios en cuotas pagadas
                        onUserEdit();
                        const chk = e.target.checked;
                        // Crear copias actualizadas del estado
                        const currentSelected = rowState?.selectedCuotas || {};
                        const currentApplied = rowState?.appliedHereById || {};
                        const next = { ...currentSelected };
                        const nextApplied = { ...currentApplied };
                        
                        if (chk) {
                          // REGLA: Al marcar, aplicar TODO el disponible disponible (hasta el máximo del ítem)
                          
                          // 1. Calcular el disponible actual (sin esta cuota)
                          // Disponible = Ingreso - (suma de todos los montos aplicados actualmente)
                          const ingresoTotal = Number(ingresoARS || 0);
                          const gastosSeleccionados = Number(totalSelGasARS || 0);
                          
                          // Sumar todas las cuotas seleccionadas con sus montos aplicados (excluyendo esta)
                          let totalCuotasAplicado = 0;
                          for (const item of appsHonNew || []) {
                            const sel = item?.selectedCuotas || {};
                            const appliedById = item?.appliedHereById || {};
                            for (const cuota of item?.cuotasResolved || []) {
                              const cuotaCid = idKey(cuota.id);
                              // Excluir esta cuota del cálculo
                              if (cuotaCid === idKey(c.id)) continue;
                              if (sel[cuotaCid]) {
                                const montoAplicado = Number(appliedById[cuotaCid] || 0);
                                totalCuotasAplicado += montoAplicado;
                              }
                            }
                          }
                          
                          // Disponible = Ingreso - Gastos aplicados - Cuotas aplicadas
                          const disponibleActual = Math.max(ingresoTotal - gastosSeleccionados - totalCuotasAplicado, 0);
                          
                          // 2. Marcar la selección
                          next[cid] = true;
                          
                          // 3. Aplicar TODO el disponible disponible (hasta el máximo del ítem)
                          if (!fullyPaid && disponibleActual > epsilon && saldoEff > epsilon) {
                            const montoAAplicar = Math.min(saldoEff, disponibleActual);
                            nextApplied[cid] = Math.round(montoAAplicar * 100) / 100;
                          } else {
                            // Si no hay disponible o la cuota está pagada, no aplicar nada
                            delete nextApplied[cid];
                          }
                          
                          // 4. Actualizar estados - asegurarse de pasar objetos nuevos
                          if (setBothForHon) {
                            setBothForHon({ ...next }, { ...nextApplied });
                          } else {
                            setSelectedForHon({ ...next });
                            setAppliedForHon({ ...nextApplied });
                          }
                        } else {
                          // REGLA: Al desmarcar, reiniciar el monto aplicado a 0
                          delete next[cid];
                          delete nextApplied[cid];
                          
                          // Actualizar estados - asegurarse de pasar objetos nuevos
                          if (setBothForHon) {
                            setBothForHon({ ...next }, { ...nextApplied });
                          } else {
                            setSelectedForHon({ ...next });
                            setAppliedForHon({ ...nextApplied });
                          }
                        }
                     }}
                  />
                </TableCell>
                                                  <TableCell>{c.numero ?? "-"}</TableCell>
                  <TableCell>{c.vencimiento ? toDMYLocal(c.vencimiento) : "—"}</TableCell>
                  <TableCell align="right">{formatMontoCuotaCell(c)}</TableCell>
                 <TableCell align="right">
                   {viewOnly 
                     ? formatCurrency(appliedHere, "ARS")
                     : (selectedMap[cid] 
                        ? formatCurrency(appliedHere, "ARS")
                        : formatCurrency(Number(c.aplicadoARS || 0), "ARS"))}
                 </TableCell>
                                     <TableCell align="right">
                     <Typography variant="body2" color={saldoEff <= epsilon ? "success.main" : "text.primary"}>
                       {formatCurrency(saldoEff, "ARS")}
                     </Typography>
                   </TableCell>
                 <TableCell>{c.isPagada ? "Pagada" : (c.estado || "—")}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
