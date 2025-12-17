// src/pages/Gastos.jsx
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { usePermisos } from "../auth/usePermissions";
import {
  Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Box, TextField, InputAdornment,
  TableSortLabel, TablePagination, Alert, Skeleton, Tooltip, Button, IconButton, Fab,
  useMediaQuery, LinearProgress, Chip, Checkbox, FormControlLabel
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { enqueueSnackbar } from "notistack";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import * as XLSX from "xlsx";
import ConfirmDialog from "../components/ConfirmDialog";

import { listGastos, deleteGasto } from "../api/finanzas/gastos";
import { formatCurrency, toDMYLocal } from "../utils/format";

/* ---------- helpers ---------- */
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

async function fetchGastosFn({ queryKey }) {
  const [_key, params] = queryKey;
  // { rows, total, meta }
  return await listGastos(params);
}

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
  const n =
    (caso.nroExpte ?? caso.expte ?? caso.numeroExpediente ?? caso.numero ?? "")
      .toString()
      .trim();
  // Si no hay número de expediente, mostrar la carátula
  if (!n) {
    const caratula = (caso.caratula || "").trim();
    return caratula || (caso.id ? `#${caso.id}` : "-");
  }
  return n;
};

const getClienteKey = (g) => {
  const s = displayCliente(g.cliente) || "";
  return s.normalize?.("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

// Fecha (formato día/mes/año)
const fmtDate = (d) => (d ? toDMYLocal(d) : "-");

// Total en ARS (usa calc.montoARS del backend si viene, si no, fallback cotización)
const computeTotalARS = (g) => {
  const calcMontoARS = Number(g?.calc?.montoARS);
  if (Number.isFinite(calcMontoARS) && calcMontoARS > 0) return calcMontoARS;
  const monto = Number(g?.monto || 0);
  const cotz = Number(g?.cotizacionARS || 0);
  return cotz > 0 ? monto * cotz : monto;
};

const getAplicadoARS = (g) => Number(g?.aplicadoARS || 0);
const getSaldoARS = (g) => {
  const total = computeTotalARS(g);
  const apl = getAplicadoARS(g);
  if (!Number.isFinite(total)) return null;
  return Math.max(total - apl, 0);
};

const toInt = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const toOrder = (v) => (v === "asc" ? "asc" : "desc");
const toOrderBy = (v) => {
  if (!v) return "fechaGasto";
  return ["fechaGasto", "concepto", "cliente", "monto"].includes(v) ? v : "fechaGasto";
};

/* ---------- componente ---------- */
export default function Gastos() {
  const nav = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Verificaciones de permisos
  const { canCrear, canEditar, canEliminar } = usePermisos('FINANZAS');

  // Estado inicial tomado de la URL
  const [page, setPage] = useState(toInt(searchParams.get("page"), 0));
  const [pageSize, setPageSize] = useState(toInt(searchParams.get("pageSize"), 10));
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const [orderBy, setOrderBy] = useState(toOrderBy(searchParams.get("orderBy")));
  const [order, setOrder] = useState(toOrder(searchParams.get("order")));

  // Filtros simples
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [soloPendientes, setSoloPendientes] = useState(searchParams.get("soloPendientes") === "true");

  // Mantener URL en sync
  useEffect(() => {
    const next = new URLSearchParams();
    if (page) next.set("page", String(page));
    if (pageSize !== 10) next.set("pageSize", String(pageSize));
    if (debouncedSearch?.trim()) next.set("search", debouncedSearch.trim());
    if (orderBy !== "fechaGasto") next.set("orderBy", orderBy);
    if (order !== "asc") next.set("order", order);
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    if (soloPendientes) next.set("soloPendientes", "true");

    const changed = next.toString() !== searchParams.toString();
    if (changed) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, orderBy, order, from, to, soloPendientes]);

  // Si cambian externamente los searchParams, actualizamos el estado local
  useEffect(() => {
    setPage(toInt(searchParams.get("page"), 0));
    setPageSize(toInt(searchParams.get("pageSize"), 10));
    setSearch(searchParams.get("search") ?? "");
    setOrderBy(toOrderBy(searchParams.get("orderBy")));
    setOrder(toOrder(searchParams.get("order")));
    setFrom(searchParams.get("from") ?? "");
    setTo(searchParams.get("to") ?? "");
    setSoloPendientes(searchParams.get("soloPendientes") === "true");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  // Confirm eliminar
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" });
  const [deletingId, setDeletingId] = useState(null);

  const params = useMemo(
    () => ({
      page: page + 1, // API espera 1-based? si no, cambialo a page
      pageSize,
      search: debouncedSearch || undefined,
      from: from || undefined,
      to: to || undefined,
      sortBy: orderBy,     // nuestra API lo mapea si coincide (fechaGasto/monto/createdAt/updatedAt).
      sortDir: order,
      soloPendientes: soloPendientes || undefined,
    }),
    [page, pageSize, debouncedSearch, from, to, orderBy, order, soloPendientes]
  );

  const { data, isFetching, isError, error, refetch, isLoading } = useQuery({
    queryKey: ["gastos", params],
    queryFn: fetchGastosFn,
    keepPreviousData: true,
    enabled: !!localStorage.getItem("token"),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const sortedRows = useMemo(() => {
    const data = Array.isArray(rows) ? [...rows] : [];
    const dir = order === "asc" ? 1 : -1;

    return data.sort((a, b) => {
      let aVal, bVal;
      
      switch (orderBy) {
        case "cliente": {
          const A = getClienteKey(a);
          const B = getClienteKey(b);
          if (!A && !B) return 0;
          if (!A) return 1;
          if (!B) return -1;
          return A.localeCompare(B) * dir;
        }
        case "caso": {
          aVal = displayExpte(a.caso).toLowerCase();
          bVal = displayExpte(b.caso).toLowerCase();
          return aVal.localeCompare(bVal) * dir;
        }
        case "concepto": {
          aVal = (a.concepto?.nombre || "").toLowerCase();
          bVal = (b.concepto?.nombre || "").toLowerCase();
          return aVal.localeCompare(bVal) * dir;
        }
        case "fechaGasto": {
          aVal = a.fechaGasto ? new Date(a.fechaGasto).getTime() : 0;
          bVal = b.fechaGasto ? new Date(b.fechaGasto).getTime() : 0;
          return (aVal - bVal) * dir;
        }
        case "totalARS": {
          aVal = computeTotalARS(a);
          bVal = computeTotalARS(b);
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          return (aVal - bVal) * dir;
        }
        case "aplicadoARS": {
          aVal = getAplicadoARS(a);
          bVal = getAplicadoARS(b);
          return (aVal - bVal) * dir;
        }
        case "saldoARS": {
          aVal = getSaldoARS(a);
          bVal = getSaldoARS(b);
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          return (aVal - bVal) * dir;
        }
        default:
          return 0;
      }
    });
  }, [rows, orderBy, order]);

  const handleSort = (prop) => {
    if (!["totalARS", "saldoARS", "cliente", "caso", "concepto", "fechaGasto", "aplicadoARS"].includes(prop)) return;
    setPage(0);
    if (orderBy === prop) setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setOrderBy(prop);
      setOrder("asc");
    }
  };

  const pedirConfirmarEliminar = (g) => {
    setConfirm({ open: true, id: g.id, name: g.descripcion || `Gasto #${g.id}` });
  };
  const cerrarConfirm = () => setConfirm({ open: false, id: null, name: "" });

  const confirmarEliminar = async () => {
    try {
      setDeletingId(confirm.id);
      await deleteGasto(confirm.id);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
      cerrarConfirm();
      refetch();
    }
  };

  // Exportar a Excel
  const handleExportExcel = async () => {
    try {
      const paramsFull = { ...params, pageSize: 10000, page: 1 };
      const { rows: todos } = await listGastos(paramsFull);

      const datos = todos.map((g) => ({
        "Fecha": fmtDate(g.fechaGasto),
        "Concepto": g.concepto?.nombre || g.concepto?.codigo || "",
        "Descripción": g.descripcion || "",
        "Monto": formatCurrency(g.monto, g.moneda?.codigo || "ARS"),
        "Moneda": g.moneda?.nombre || g.moneda?.codigo || "",
        "Cotización": g.cotizacionARS ? Number(g.cotizacionARS).toFixed(4) : "",
        "Importe": formatCurrency(computeTotalARS(g), "ARS"),
        "Cobrado": formatCurrency(getAplicadoARS(g), "ARS"),
        "Saldo": formatCurrency(getSaldoARS(g), "ARS"),
        "Cliente": displayCliente(g.cliente),
        "Caso": displayExpte(g.caso),
      }));

      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Gastos");
      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `gastos_${fecha}.xlsx`);
      enqueueSnackbar("Excel exportado correctamente", { variant: "success" });
    } catch (e) {
      enqueueSnackbar("Error al exportar a Excel", { variant: "error" });
      console.error(e);
    }
  };

  // Acciones
  const crear = () => nav("/finanzas/gastos/nuevo", { state: { from: { pathname: "/finanzas", search: "?tab=gastos" } } });
  const editar = (id) => nav(`/finanzas/gastos/editar/${id}`, { state: { from: { pathname: "/finanzas", search: "?tab=gastos" } } });

  /* ---------- Header (mobile y desktop) ---------- */

  // Desktop
  const DesktopHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>


        <TextField
          size="small"
          placeholder="Buscar por cliente, expte…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: { xs: "100%", md: 280 } }}
        />

        <Box sx={{
          display: "flex",
          gap: 2,
          alignItems: "center",
          flexWrap: "wrap",
          ml: { xs: 0, md: "auto" }
        }}>
          <TextField
            size="small" type="date" label="Desde" InputLabelProps={{ shrink: true }}
            value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small" type="date" label="Hasta" InputLabelProps={{ shrink: true }}
            value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }}
            sx={{ minWidth: 160 }}
          />

          {!isMobile && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExportExcel}
              sx={{ textTransform: "none" }}
              disabled={isFetching}
            >
              Exportar
            </Button>
          )}

          {canCrear && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={crear} sx={{ textTransform: "none" }}>
              Nuevo
            </Button>
          )}
        </Box>
      </Box>

      {/* Solo pendientes debajo */}
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!soloPendientes}
              onChange={(e) => { setSoloPendientes(e.target.checked); setPage(0); }}
            />
          }
          label="Solo pendientes"
        />
      </Box>
    </Box>
  );

  // Mobile
  const MobileHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, mb: 1 }}>
        Gastos
      </Typography>

      <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por cliente, expte…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          size="small"
          type="date"
          label="Desde"
          InputLabelProps={{ shrink: true }}
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(0); }}
        />
        <TextField
          size="small"
          type="date"
          label="Hasta"
          InputLabelProps={{ shrink: true }}
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(0); }}
        />

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            select size="small" label="Ordenar por"
            value={orderBy}
            onChange={(e) => { setOrderBy(e.target.value); setOrder("asc"); setPage(0); }}
            sx={{ flex: 1, minWidth: 160 }}
            SelectProps={{ native: true }}
          >
            <option value="totalARS">Importe ($)</option>
            <option value="saldoARS">Saldo ($)</option>
            <option value="cliente">Cliente (A–Z)</option>
          </TextField>
          <IconButton
            size="small"
            onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
            aria-label="Cambiar orden"
            sx={{ border: 1, borderColor: "divider" }}
          >
            {order === "asc" ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
          </IconButton>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={!!soloPendientes}
              onChange={(e) => { setSoloPendientes(e.target.checked); setPage(0); }}
            />
          }
          label="Solo pendientes"
        />
      </Box>
    </Box>
  );

  const Header = isMobile ? MobileHeader : DesktopHeader;
  const ProgressBar = (isFetching || isLoading) ? (
    <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
  ) : null;

  /* ---------- Mobile list ---------- */
  const MobileList = (
    <Box sx={{ display: "grid", gap: 1.25, px: 1, overflowX: "hidden" }}>
      {isFetching && rows.length === 0
        ? Array.from({ length: 6 }).map((_, i) => (
            <Paper key={`m-skel-${i}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Skeleton width="50%" />
            </Paper>
          ))
        : sortedRows.map((g) => {
            const total = computeTotalARS(g);
            const aplicado = getAplicadoARS(g);
            const saldo = getSaldoARS(g);

            return (
              <Paper key={g.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2, borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/*<Typography variant="subtitle2" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.descripcion?.trim() || `Gasto #${g.id}`}
                    </Typography>*/}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {displayCliente(g.cliente)} · Expte: {displayExpte(g.caso)}
                    </Typography>
                    {/*<Typography variant="caption" sx={{ opacity: 0.75 }}>
                      Fecha: {fmtDate(g.fechaGasto)}
                    </Typography>*/}

                    <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {g.concepto?.nombre && <Chip size="small" variant="outlined" label={g.concepto.nombre} />}
                      <Chip size="small" label={`Importe: ${formatCurrency(total, "ARS")}`} />
                      <Chip size="small" label={`Cobrado: ${formatCurrency(aplicado, "ARS")}`} />
                      <Chip
                        size="small"
                        color={Number(saldo) > 0 ? "warning" : "success"}
                        label={`Saldo: ${saldo != null ? formatCurrency(saldo, "ARS") : "—"}`}
                      />
                      
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {canEditar && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => editar(g.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEliminar && (
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => pedirConfirmarEliminar(g)}
                          disabled={deletingId === g.id}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Paper>
            );
          })}

      {!isFetching && rows.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="body1" sx={{ mb: 0.5 }}>
            No encontramos gastos para mostrar.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.8 }}>
            Probá ajustar la búsqueda o creá un gasto nuevo.
          </Typography>
          <Button variant="contained" size="small" onClick={crear}>
            Nuevo
          </Button>
        </Paper>
      )}
    </Box>
  );

  /* ---------- Desktop table ---------- */
  const DesktopTable = (
    <Box
      sx={{
        overflow: "auto",
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Table
        size="small"
        stickyHeader
        sx={{
          "& td, & th": {
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
            verticalAlign: "middle",
            lineHeight: 1.6,
          },
        }}
      >
        <TableHead>
          <TableRow
            sx={{
              "& th": {
                bgcolor: (t) => (t.palette.mode === "dark" ? "background.default" : "#fafafa"),
                fontWeight: 600,
              },
            }}
          >
            <TableCell sx={{ width: 260 }}>
              <TableSortLabel
                active={orderBy === "cliente"}
                direction={orderBy === "cliente" ? order : "asc"}
                onClick={() => handleSort("cliente")}
              >
                Cliente
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 280 }} sortDirection={orderBy === "caso" ? order : false}>
              <TableSortLabel
                active={orderBy === "caso"}
                direction={orderBy === "caso" ? order : "asc"}
                onClick={() => handleSort("caso")}
              >
                Expte
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: 130 }} sortDirection={orderBy === "concepto" ? order : false}>
              <TableSortLabel
                active={orderBy === "concepto"}
                direction={orderBy === "concepto" ? order : "asc"}
                onClick={() => handleSort("concepto")}
              >
                Concepto
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: 130 }} sortDirection={orderBy === "fechaGasto" ? order : false}>
              <TableSortLabel
                active={orderBy === "fechaGasto"}
                direction={orderBy === "fechaGasto" ? order : "asc"}
                onClick={() => handleSort("fechaGasto")}
              >
                Fecha
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 160 }} sortDirection={orderBy === "totalARS" ? order : false} align="right">
              <TableSortLabel
                active={orderBy === "totalARS"}
                direction={orderBy === "totalARS" ? order : "asc"}
                onClick={() => handleSort("totalARS")}
              >
                Importe
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 160 }} align="right" sortDirection={orderBy === "aplicadoARS" ? order : false}>
              <TableSortLabel
                active={orderBy === "aplicadoARS"}
                direction={orderBy === "aplicadoARS" ? order : "asc"}
                onClick={() => handleSort("aplicadoARS")}
              >
                Cobrado
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 160 }} sortDirection={orderBy === "saldoARS" ? order : false} align="center">
              <TableSortLabel
                active={orderBy === "saldoARS"}
                direction={orderBy === "saldoARS" ? order : "asc"}
                onClick={() => handleSort("saldoARS")}
              >
                Saldo
              </TableSortLabel>
            </TableCell>

            <TableCell align="right" sx={{ width: 120, whiteSpace: "nowrap" }}>
              Acciones
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody
          sx={{
            "& tr:hover": { backgroundColor: (t) => t.palette.action.hover },
            "& tr:nth-of-type(odd)": {
              backgroundColor: (t) => (t.palette.mode === "dark" ? "transparent" : "#fcfcfc"),
            },
          }}
        >
          {isFetching && rows.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell><Skeleton width="80%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell><Skeleton width="50%" /></TableCell>
                  <TableCell><Skeleton width="50%" /></TableCell>
                  <TableCell align="right"><Skeleton width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton width="90px" /></TableCell>
                </TableRow>
              ))
            : sortedRows.map((g) => {
                const total = computeTotalARS(g);
                const aplicado = getAplicadoARS(g);
                const saldo = getSaldoARS(g);

                return (
                  <TableRow key={g.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {displayCliente(g.cliente)}
                    </TableCell>

                    <TableCell>{displayExpte(g.caso)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {g.concepto?.nombre || "—"}
                    </TableCell>
                    <TableCell>{fmtDate(g.fechaGasto)}</TableCell>

                    <TableCell align="right">
                      {formatCurrency(total, "ARS")}
                    </TableCell>

                    <TableCell align="right">
                      {formatCurrency(aplicado, "ARS")}
                    </TableCell>

                    <TableCell align="right">
                      {saldo != null
                        ? <Chip size="small" color={Number(saldo) > 0 ? "warning" : "success"} label={formatCurrency(saldo, "ARS")} />
                        : "—"}
                    </TableCell>

                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {canEditar && (
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => editar(g.id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEliminar && (
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => pedirConfirmarEliminar(g)}
                            disabled={deletingId === g.id}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

          {!isFetching && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8}>
                <Box sx={{ py: 6, textAlign: "center", opacity: 0.8 }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    No encontramos gastos para mostrar.
                  </Typography>
                  <Typography variant="body2">
                    Probá ajustar la búsqueda o creá un gasto nuevo.
                  </Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );

  return (
    <Box>
      {Header}
      {(isFetching || isLoading) && ProgressBar}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || "Ocurrió un error al cargar los gastos."}
        </Alert>
      )}

      {isMobile ? MobileList : DesktopTable}

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_e, newPage) => setPage(newPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage="Filas por página"
        sx={{ mt: 1 }}
      />

      {/* FAB "Nuevo" en mobile */}
      {isMobile && (
        <Fab
          color="primary"
          onClick={crear}
          sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 1200, width: 64, height: 64, boxShadow: 5 }}
          aria-label="Nuevo gasto"
        >
          <AddIcon sx={{ fontSize: 28 }} />
        </Fab>
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Eliminar gasto"
        description={`¿Seguro que querés eliminar "${confirm.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmColor="error"
        loading={deletingId === confirm.id}
        onClose={cerrarConfirm}
        onConfirm={confirmarEliminar}
      />
    </Box>
  );
}
