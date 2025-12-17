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
   - editMode?: boolean // si true, muestra todos los gastos (incluidos saldados); si false, solo pendientes
   - gastosAplicadosAEsteIngreso?: number[] // IDs de gastos aplicados a este ingreso (para mostrar en edición aunque estén saldados)
========================================================= */
export default function IngresoGastosForm({
  clienteId,
  casoId,
  ingresoDisponibleARS,
  value = [],
  onChange,
  noFrame = false,
  editMode = false,
  gastosAplicadosAEsteIngreso = [],
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
      // En modo edición, mostrar todos los gastos (incluidos saldados) para que no desaparezcan al desmarcarlos
      // En modo alta, solo mostrar pendientes
      soloPendientes: !editMode,
      sortBy: "fechaGasto",
      sortDir: "desc",
    }),
    [page, pageSize, clienteId, casoId, editMode]
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

  // En modo edición, también incluir gastos aplicados a este ingreso que no están en la página actual
  const missingAplicadosIds = useMemo(() => {
    if (!editMode) return [];
    const gastosAplicadosIds = gastosAplicadosAEsteIngreso.map(String);
    return gastosAplicadosIds.filter((id) => !presentSet.has(id));
  }, [editMode, gastosAplicadosAEsteIngreso, presentSet]);

  // Combinar IDs faltantes: seleccionados + aplicados a este ingreso
  const allMissingIds = useMemo(() => {
    const combined = new Set([...missingSelIds, ...missingAplicadosIds]);
    return Array.from(combined);
  }, [missingSelIds, missingAplicadosIds]);

  const {
    data: selectedExtras = [],
    isFetching: fetchingExtras,
    isLoading: loadingExtras,
  } = useQuery({
    queryKey: ["gastos-seleccionados-extra", allMissingIds],
    queryFn: async () => {
      if (!allMissingIds.length) return [];
      const res = await Promise.all(
        allMissingIds.map((id) =>
          getGasto(id).then((r) => r?.data ?? r).catch(() => null)
        )
      );
      return res.filter(Boolean);
    },
    // ✅ en edición funciona aunque no haya clienteId
    enabled: allMissingIds.length > 0,
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
    const allMerged = [];
    for (const r of [...selectedFirst, ...rest, ...extrasNotSelected]) {
      const id = String(r.id);
      if (!seen.has(id)) {
        seen.add(id);
        allMerged.push(r);
      }
    }
    
    // En modo edición, filtrar para mostrar solo:
    // - Gastos pendientes (saldoARS > 0)
    // - Gastos aplicados a este ingreso (en gastosAplicadosAEsteIngreso)
    // - Gastos seleccionados actualmente (en value)
    if (editMode) {
      const gastosAplicadosSet = new Set(gastosAplicadosAEsteIngreso.map(String));
      const selIdsSet = new Set(selIds);
      return allMerged.filter((g) => {
        const id = String(g.id);
        const saldo = saldoARSFromGasto(g);
        // Mostrar si: está pendiente, está aplicado a este ingreso, o está seleccionado actualmente
        return saldo > 0 || gastosAplicadosSet.has(id) || selIdsSet.has(id);
      });
    }
    
    return allMerged;
  }, [allRows, selectedExtras, selIds, editMode, gastosAplicadosAEsteIngreso]);

  const isFetching = fetchingPend || fetchingExtras;
  const isLoading = (loadingPend || loadingExtras) && rows.length === 0;

  // Cache saldos para asignación
  const saldoCacheRef = useRef(new Map()); // id -> saldoARS
  const isAllocatingRef = useRef(false); // Flag para evitar bucles infinitos
  useEffect(() => {
    for (const g of rows) {
      saldoCacheRef.current.set(String(g.id), saldoARSFromGasto(g));
    }
    // ⚠️ No forzar allocate si no hay selección aún (evita pisar estado del padre)
    // ⚠️ No forzar allocate si ya estamos en medio de una asignación (evita bucles infinitos)
    if (value?.length && !isAllocatingRef.current) {
      allocate(value.map((v) => v.gastoId), /*preserve*/ !Number.isFinite(ingresoDisponibleARS));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // Reasignación automática según nuevas reglas:
  // - Al marcar: aplicar TODO el disponible disponible (hasta el máximo del ítem)
  // - Al desmarcar: reiniciar a 0
  // - El disponible se calcula como: Ingreso - (suma de montos aplicados)
  function allocate(selectedIds, preserveExistingMontos = false) {
    // Prevenir bucles infinitos
    if (isAllocatingRef.current) return;
    isAllocatingRef.current = true;
    
    try {
      // Si preserveExistingMontos es true (modo edición sin ingresoDisponibleARS o cuando el disponible disminuye), preservar montos existentes
      if (preserveExistingMontos) {
        const currentById = new Map(
          (value || []).map((v) => [String(v.gastoId), Number(v.monto)])
        );
        const next = selectedIds.map((rawId) => {
          const id = String(rawId);
          const existing = currentById.has(id) ? Number(currentById.get(id) || 0) : 0;
          return { gastoId: rawId, monto: existing.toFixed(2) };
        });
        // IMPORTANTE: Crear una nueva referencia del array para que React detecte el cambio
        const nextArray = [...next];
        onChange?.(nextArray);
        return;
      }

    // REGLA: Calcular el disponible actual
    // ingresoDisponibleARS = Ingreso - Cuotas aplicadas (sin incluir gastos)
    // Disponible para gastos = ingresoDisponibleARS - (suma de montos aplicados a gastos que NO están en selectedIds)
    let disponibleActual = Number.isFinite(ingresoDisponibleARS)
      ? Number(ingresoDisponibleARS)
      : 0;

    // Sumar los montos aplicados a los gastos que NO están en selectedIds (liberar esos montos)
    const currentById = new Map(
      (value || []).map((v) => [String(v.gastoId), Number(v.monto)])
    );
    for (const [id, monto] of currentById) {
      if (!selectedIds.includes(Number(id))) {
        disponibleActual += monto; // Liberar el monto de los gastos desmarcados
      }
    }
    
    // Restar los montos de los gastos que SÍ están en selectedIds (liberar para recalcular)
    for (const rawId of selectedIds) {
      const id = String(rawId);
      if (currentById.has(id)) {
        const montoExistente = Number(currentById.get(id) || 0);
        disponibleActual += montoExistente; // Liberar el monto existente para recalcular
      }
    }

    // REGLA: Aplicar TODO el disponible disponible a cada gasto marcado (hasta su máximo)
    // ✅ IMPORTANTE: Mantener todos los gastos seleccionados, incluso si el disponible es 0
    // Esto evita que se pierdan gastos cuando se selecciona una cuota
    const next = [];
    for (const rawId of selectedIds) {
      const id = String(rawId);
      const saldo = Number(saldoCacheRef.current.get(id) ?? 0);
      const existing = currentById.get(id);
      
      // Aplicar el mínimo entre el disponible y el saldo del gasto
      // ✅ Si hay disponible, distribuirlo. Si no hay disponible, mantener el monto existente
      let montoAAplicar = 0;
      if (disponibleActual > 0 && saldo > 0) {
        // Hay disponible: aplicar lo máximo posible
        montoAAplicar = Math.min(saldo, disponibleActual);
        disponibleActual -= montoAAplicar;
      } else if (existing !== undefined && existing > 0) {
        // No hay disponible pero hay monto existente: preservarlo
        montoAAplicar = existing;
      }
      // Si no hay disponible ni monto existente, montoAAplicar queda en 0
      next.push({ gastoId: rawId, monto: montoAAplicar.toFixed(2) });
    }

    // IMPORTANTE: Siempre crear una nueva referencia del array para que React detecte el cambio
    const nextArray = [...next];
    
    // Comparar normalizando montos (pueden venir como string o number)
    const normalize = (arr) => {
      if (!Array.isArray(arr)) return [];
      return arr
        .map((a) => ({
          gastoId: Number(a.gastoId),
          monto: Number(String(a.monto || 0).replace(/,/g, ".")),
        }))
        .sort((a, b) => a.gastoId - b.gastoId);
    };
    const nextNorm = normalize(nextArray);
    const valueNorm = normalize(value || []);
    const same =
      nextNorm.length === valueNorm.length &&
      nextNorm.every((a, i) => {
        const b = valueNorm[i];
        return a.gastoId === b.gastoId && Math.abs(a.monto - b.monto) < 0.01; // tolerancia para decimales
      });
    // IMPORTANTE: Siempre llamar a onChange con una nueva referencia del array
    // Esto asegura que React detecte el cambio y actualice los totales
    // ✅ Siempre llamar onChange si hay gastos seleccionados, incluso si los montos no cambiaron
    // Esto asegura que el estado se actualice correctamente cuando se seleccionan múltiples gastos
    if (nextArray.length > 0 || !same || nextArray.length !== (value?.length || 0)) {
      onChange?.(nextArray);
    }
    } finally {
      // Liberar el flag después de un pequeño delay para permitir que los efectos se completen
      setTimeout(() => {
        isAllocatingRef.current = false;
      }, 0);
    }
  }

  // Ref para rastrear el último valor de ingresoDisponibleARS que procesamos
  const lastDisponibleRef = useRef(ingresoDisponibleARS);
  
  useEffect(() => {
    // Solo recalcular si el disponible cambió Y no estamos en medio de una asignación
    // Y el cambio es significativo (más de 0.01 de diferencia)
    const disponibleCambio = Math.abs((ingresoDisponibleARS || 0) - (lastDisponibleRef.current || 0));
    // ✅ En modo edición, preservar montos existentes cuando el disponible cambia
    // Solo recalcular si el disponible AUMENTA (hay más disponible para distribuir)
    const disponibleAumento = (ingresoDisponibleARS || 0) > (lastDisponibleRef.current || 0);
    if (disponibleCambio > 0.01 && value?.length && !isAllocatingRef.current) {
      lastDisponibleRef.current = ingresoDisponibleARS;
      // ✅ Si el disponible disminuyó (se seleccionó una cuota), preservar montos existentes
      // Si el disponible aumentó (se deseleccionó una cuota), recalcular para distribuir el nuevo disponible
      const preserveMontos = editMode && !disponibleAumento;
      allocate(
        value.map((v) => v.gastoId),
        preserveMontos
      );
    } else if (disponibleCambio <= 0.01) {
      // Actualizar la referencia incluso si no recalculamos
      lastDisponibleRef.current = ingresoDisponibleARS;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingresoDisponibleARS, editMode]);

  // selección
  const selSet = useMemo(() => new Set(selIds.map(String)), [selIds]);
  const toggleRow = (g) => {
    const key = String(g.id);
    saldoCacheRef.current.set(key, saldoARSFromGasto(g));

    if (selSet.has(key)) {
      // Desmarcar: eliminar de la lista
      // IMPORTANTE: Crear una nueva referencia del array para que React detecte el cambio
      const next = [...value.filter((v) => String(v.gastoId) !== key)];
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

                  // ✅ Calcular si el gasto debe estar deshabilitado
                  // Deshabilitar si:
                  // 1. El gasto no está seleccionado Y
                  // 2. El disponible es 0 o menor que el saldo del gasto
                  const disponibleActual = Number.isFinite(ingresoDisponibleARS) ? Number(ingresoDisponibleARS) : 0;
                  const saldoGasto = saldoARSFromGasto(g);
                  const disabled = !checked && (disponibleActual <= 0 || disponibleActual < saldoGasto);

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
                          disabled={disabled}
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

