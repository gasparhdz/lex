// src/pages/IngresoGastosForm.jsx
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Paper,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  LinearProgress,
  Alert,
  Skeleton,
} from "@mui/material";
import { listGastos, getGasto } from "../api/finanzas/gastos";
import { formatCurrency } from "../utils/format";
import { alpha } from "@mui/material/styles";

/* ---------- helpers ---------- */
const displayCliente = (c) => {
  if (!c) return "Sin cliente";
  if (c.razonSocial?.trim()) return c.razonSocial.trim();
  const a = (c.apellido || "").trim();
  const n = (c.nombre || "").trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || "Sin nombre";
};
const displayExpte = (caso) => {
  if (!caso) return "-";
  const n = (
    caso.nroExpte ??
    caso.expte ??
    caso.numeroExpediente ??
    caso.numero ??
    ""
  )
    .toString()
    .trim();
  return n || (caso.id ? `#${caso.id}` : "-");
};
function totalARSFromGasto(g) {
  const calc = Number(g?.calc?.montoARS);
  if (Number.isFinite(calc)) return calc;
  const m = Number(g?.monto || 0);
  const c = Number(g?.cotizacionARS || 0);
  return c > 0 ? +(m * c).toFixed(2) : m;
}
function saldoARSFromGasto(g) {
  if (Number.isFinite(g?.saldoARS)) return Number(g.saldoARS);
  const t = totalARSFromGasto(g);
  const apl = Number(g?.aplicadoARS || 0);
  return Math.max(0, +(t - apl).toFixed(2));
}

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

/* =========================================================
   Props:
   - clienteId (requerido para listar pendientes; en edición puede venir vacío)
   - casoId?   (opcional para filtrar)
   - ingresoDisponibleARS? (tope de asignación automática; si no viene -> preservar montos)
   - value: [{ gastoId, monto }]   // selección controlada
   - onChange(nextValue)
   - noFrame?: boolean  // si true, no envuelve en Paper (evita doble borde)
========================================================= */
export default function IngresoGastosForm({
  clienteId,
  casoId,
  ingresoDisponibleARS,
  value = [],
  onChange,
  noFrame = false,
}) {
  // paginación (sin buscador)
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const params = useMemo(
    () => ({
      page: page + 1, // back usa 1-based
      pageSize,
      clienteId: clienteId ? Number(clienteId) : undefined,
      casoId: casoId ? Number(casoId) : undefined,
      // En modo edición, NO filtrar solo pendientes para que los aplicados sigan viéndose
      soloPendientes: false,
      sortBy: "fechaGasto",
      sortDir: "desc",
    }),
    [page, pageSize, clienteId, casoId]
  );

  /* --------- 1) Todos los gastos del cliente/caso (no solo pendientes en edición) --------- */
  const {
    data: dataPend,
    isFetching: fetchingPend,
    isLoading: loadingPend,
  } = useQuery({
    queryKey: ["gastos-cliente", params],
    queryFn: () => listGastos(params), // -> { rows, total }
    enabled: !!clienteId, // en edición podría ser false; igual mostraremos seleccionados
    keepPreviousData: true,
  });

  const allRows = dataPend?.rows ?? [];
  const totalPend = dataPend?.total ?? 0;

  /* --------- 2) Gastos seleccionados faltantes (no están en la página actual) --------- */
  const selIds = useMemo(() => value.map((v) => String(v.gastoId)), [value]);
  const presentSet = useMemo(
    () => new Set(allRows.map((r) => String(r.id))),
    [allRows]
  );
  const missingSelIds = useMemo(
    () => selIds.filter((id) => !presentSet.has(id)),
    [selIds, presentSet]
  );

  const {
    data: selectedExtras = [],
    isFetching: fetchingExtras,
    isLoading: loadingExtras,
  } = useQuery({
    queryKey: ["gastos-seleccionados-extra", missingSelIds],
    queryFn: async () => {
      if (!missingSelIds.length) return [];
      const res = await Promise.all(
        missingSelIds.map((id) =>
          getGasto(id).then((r) => r?.data ?? r).catch(() => null)
        )
      );
      return res.filter(Boolean);
    },
    // ✅ en edición funciona aunque no haya clienteId
    enabled: missingSelIds.length > 0,
    staleTime: 60_000,
    keepPreviousData: true,
  });

  /* --------- 3) Merge: todos los gastos (paginados + extras si faltan) --------- */
  const rows = useMemo(() => {
    const byId = new Map();
    for (const r of allRows) byId.set(String(r.id), r);
    for (const r of selectedExtras) byId.set(String(r.id), r); // pisa si hace falta
    
    // Todos los gastos sin duplicar (seleccionados primero en el orden de value)
    const selectedFirst = selIds.map((id) => byId.get(id)).filter(Boolean);
    const rest = allRows.filter((r) => !selIds.includes(String(r.id)));
    const extrasNotSelected = selectedExtras.filter((r) => !selIds.includes(String(r.id)));
    
    // Consolidar sin duplicar
    const seen = new Set();
    const result = [];
    for (const r of [...selectedFirst, ...rest, ...extrasNotSelected]) {
      const id = String(r.id);
      if (!seen.has(id)) {
        seen.add(id);
        result.push(r);
      }
    }
    
    return result;
  }, [allRows, selectedExtras, selIds]);

  const isFetching = fetchingPend || fetchingExtras;
  const isLoading = (loadingPend || loadingExtras) && rows.length === 0;

  // Cache saldos para asignación
  const saldoCacheRef = useRef(new Map()); // id -> saldoARS
  useEffect(() => {
    for (const g of rows) {
      saldoCacheRef.current.set(String(g.id), saldoARSFromGasto(g));
    }
    // ⚠️ No forzar allocate si no hay selección aún (evita pisar estado del padre)
    if (value?.length) {
      allocate(value.map((v) => v.gastoId), /*preserve*/ !Number.isFinite(ingresoDisponibleARS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Reasignación automática (con modo "preservar montos" para edición)
  function allocate(selectedIds, preserveExistingMontos = false) {
    // mapa de montos actuales (value) por id
    const currentById = new Map(
      (value || []).map((v) => [String(v.gastoId), Number(v.monto)])
    );

    let remaining = Number.isFinite(ingresoDisponibleARS)
      ? Number(ingresoDisponibleARS)
      : Infinity;

    const next = [];
    for (const rawId of selectedIds) {
      const id = String(rawId);
      const saldo = Number(saldoCacheRef.current.get(id) ?? 0);

      let monto;
      if (preserveExistingMontos && currentById.has(id)) {
        // En edición: respetar lo que ya estaba, pero si es 0 o no existe, asignar el saldo completo
        const existing = Number(currentById.get(id) || 0);
        monto = existing > 0 ? Math.max(0, Math.min(saldo, existing)) : saldo;
      } else {
        // En alta o cuando hay tope disponible: asignar hasta saldo o remaining
        const cap = Number.isFinite(remaining) ? remaining : saldo;
        monto = Math.max(0, Math.min(saldo, cap));
      }

      next.push({ gastoId: rawId, monto: monto.toFixed(2) });
      if (Number.isFinite(remaining)) remaining -= monto;
    }

    const sameLen = next.length === value.length;
    const same =
      sameLen &&
      next.every(
        (a, i) =>
          String(a.gastoId) === String(value[i].gastoId) &&
          String(a.monto) === String(value[i].monto)
      );
    if (!same) onChange?.(next);
  }

  useEffect(() => {
    // Si cambia el tope, recalculamos.
    // Si el tope no es finito (edición), preservamos montos existentes.
    if (value?.length) {
      allocate(
        value.map((v) => v.gastoId),
        /*preserveExistingMontos*/ !Number.isFinite(ingresoDisponibleARS)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingresoDisponibleARS]);

  // selección
  const selSet = useMemo(() => new Set(selIds.map(String)), [selIds]);
  const toggleRow = (g) => {
    const key = String(g.id);
    saldoCacheRef.current.set(key, saldoARSFromGasto(g));

    if (selSet.has(key)) {
      // Desmarcar: eliminar de la lista
      const next = value.filter((v) => String(v.gastoId) !== key);
      onChange?.(next);
    } else {
      // Marcar: agregar a la lista
      const nextIds = [...selIds, g.id];
      allocate(nextIds, /*preserveExistingMontos*/ !Number.isFinite(ingresoDisponibleARS));
    }
  };


  const LoadingBar = isFetching || isLoading ? <LinearProgress sx={{ mb: 1 }} /> : null;

  const TableSkeleton = Array.from({ length: 6 }).map((_, i) => (
    <TableRow key={`sk-${i}`}>
      <TableCell padding="checkbox">
        <Skeleton variant="rectangular" width={18} height={18} />
      </TableCell>
      <TableCell>
        <Skeleton width="60%" />
      </TableCell>
      <TableCell>
        <Skeleton width="40%" />
      </TableCell>
      <TableCell>
        <Skeleton width="50%" />
      </TableCell>
      <TableCell align="right">
        <Skeleton width="60%" />
      </TableCell>
      <TableCell align="right">
        <Skeleton width="60%" />
      </TableCell>
    </TableRow>
  ));

  // Si no hay pendientes pero sí seleccionados, el paginador no debe decir 0.
  const countForPagination = totalPend > 0 ? totalPend : rows.length;

  const showAlertSeleccionCliente =
    !clienteId && (value?.length ?? 0) === 0; // en edición con value, no mostrar alert

  // Wrapper para evitar doble borde cuando el padre ya enmarca
  const Wrapper = ({ children }) =>
    noFrame ? (
      <>{children}</>
    ) : (
      <Paper variant="outlined" sx={{ p: 0, borderRadius: 2, overflow: "hidden" }}>
        {children}
      </Paper>
    );

  return (
    <Wrapper>
      {LoadingBar}

      {showAlertSeleccionCliente && (
        <Alert severity="info" sx={{ m: 1.5 }}>
          Seleccioná un cliente (y opcionalmente un caso) para listar gastos pendientes.
        </Alert>
      )}

      <Box
        sx={{
          opacity: clienteId ? 1 : 1, // ✅ en edición sin cliente igual mostramos seleccionados
          pointerEvents: clienteId ? "auto" : "auto",
        }}
      >
        <Table
          size="small"
          sx={{
            "& td, & th": {
              borderBottom: (t) => `1px solid ${t.palette.divider}`,
              lineHeight: 1.5,
            },
            "& tbody tr:hover": {
              backgroundColor: (t) => t.palette.action.hover,
            },
          }}
        >
          <TableHead
            sx={{
              "& th": {
                fontWeight: 700,
                backgroundColor: (t) =>
                  t.palette.mode === "dark"
                    ? alpha(t.palette.grey[600], 0.2)
                    : t.palette.grey[100],
              },
            }}
          >
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Cliente</TableCell>
              <TableCell>Expte</TableCell>
              <TableCell>Descripción</TableCell>
              <TableCell align="right">Total ARS</TableCell>
              <TableCell align="right">Saldo ARS</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {isLoading
              ? TableSkeleton
              : rows.map((g) => {
                  const key = String(g.id);
                  const checked = selSet.has(key);
                  const total = totalARSFromGasto(g);
                  const saldo = saldoARSFromGasto(g);

                  return (
                    // ⛔ No seteamos fondo acá (Honorarios tampoco lo hace en el detalle),
                    // dejamos que el tema maneje el hover y fondo base.
                    <TableRow key={key} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          color="primary"
                          sx={(t) => checkboxSx(t)}
                          checked={checked}
                          onChange={() => toggleRow(g)}
                        />
                      </TableCell>
                      <TableCell
                        sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {displayCliente(g.cliente)}
                      </TableCell>
                      <TableCell>{displayExpte(g.caso)}</TableCell>
                      <TableCell
                        sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {g.descripcion?.trim() || `Gasto #${g.id}`}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(total, "ARS")}</TableCell>
                      <TableCell align="right">{formatCurrency(saldo, "ARS")}</TableCell>
                    </TableRow>
                  );
                })}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box sx={{ py: 5, textAlign: "center", opacity: 0.8 }}>
                    No hay gastos para mostrar.
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <TablePagination
        component="div"
        count={countForPagination}
        page={page}
        onPageChange={(_e, newPage) => setPage(newPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setPageSize(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage="Filas por página"
        sx={{ mt: 0 }}
      />
    </Wrapper>
  );
}
