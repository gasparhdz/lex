// src/pages/Honorarios.jsx
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
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import * as XLSX from "xlsx";
import ConfirmDialog from "../components/ConfirmDialog";
import api from "../api/axios";

import { listHonorarios, getValorJusActual, deleteHonorario } from "../api/finanzas/honorarios";
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

async function fetchHonorariosFn({ queryKey }) {
  const [_key, params] = queryKey;
  return await listHonorarios(params); // { rows, total }
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
    (caso.nroExpte ??
      caso.expte ??
      caso.numeroExpediente ??
      caso.numero ??
      "")
      .toString()
      .trim();
  // Si no hay número de expediente, mostrar la carátula
  if (!n) {
    const caratula = (caso.caratula || "").trim();
    return caratula || (caso.id ? `#${caso.id}` : "-");
  }
  return n;
};
const getClienteKey = (h) => {
  const s = displayCliente(h.cliente) || "";
  // sin acentos y en mayúsculas para ordenar prolijo
  return s.normalize?.("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

// (si en algún momento seguís usando, queda)
const fmtDate = (d) => (d ? toISODateString(d) : "-");

// $ Importe fijo (ARS) para la lista
const computeImporteARS = (h) => {
  const mp = Number(h?.montoPesos);
  if (Number.isFinite(mp)) return mp;

  const jus = Number(h?.jus);
  const vj  = Number(h?.valorJusRef);
  if (Number.isFinite(jus) && Number.isFinite(vj)) return jus * vj;

  return null;
};

// Moneda para mostrar en listado
const monedaLabel = (h) =>
  h?.moneda?.nombre || h?.moneda?.codigo || ((h.jus != null) ? "JUS" : "$");

// ¿Es JUS? Preferí mirar la moneda.
const isJusHonorario = (h) => {
  const cod = (h?.moneda?.codigo || h?.moneda?.nombre || "").toString().toUpperCase();
  if (cod.includes("JUS")) return true;
  // fallback por si no vino la moneda
  const jus = h?.jus;
  return jus != null && Number(jus) > 0;
};

// Cantidad de JUS solo si es > 0
const getCantJus = (h) => {
  const n = Number(h?.jus);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Saldo mostrado
const getSaldoMostrado = (h, valorJusHoy) => {
  if (isJusHonorario(h)) {
    const jusTotal = Number(h?.jus) || 0;
    const vj = Number(valorJusHoy) || Number(h?.valorJusRef) || 0;
    if (!vj) return null;
    const cobradoARS = getCobrado(h);
    const jusPagadosEquivHoy = cobradoARS / vj;
    const jusPendiente = Math.max(jusTotal - jusPagadosEquivHoy, 0);
    return jusPendiente * vj;
  }

  // ARS u otra moneda: Importe - Cobrado
  const importe = computeImporteARS(h);
  if (importe == null) return null;
  const cobrado = getCobrado(h);
  return Math.max(importe - cobrado, 0);
};


// $ Cobrado: uso campo directo o sumo arrays comunes; si nada, 0
const getCobrado = (h) => {
  const direct = Number(h?.cobrado);
  if (Number.isFinite(direct)) return direct;

  const coleccion =
    h?.pagos || h?.cobranzas || h?.ingresos || h?.movimientos || null;

  if (Array.isArray(coleccion)) {
    const s = coleccion.reduce(
      (acc, it) => acc + (Number(it?.monto) || Number(it?.importe) || 0),
      0
    );
    if (s) return s;
  }
  return 0;
};



// $ Saldo: usa campo directo o Importe - Cobrado; null si no hay importe
const getSaldo = (h) => {
  const direct = Number(h?.saldo);
  if (Number.isFinite(direct)) return direct;

  const imp = computeImporteARS(h);
  if (imp == null) return null;
  const cob = getCobrado(h);
  return imp - cob;
};

const toInt = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const toOrder = (v) => (v === "desc" ? "desc" : "asc");
const toOrderBy = (v) => {
  if (!v) return "fechaHonorario";
  return ["fechaHonorario", "cliente"].includes(v) ? v : "fechaHonorario";
};

/* ---------- componente ---------- */
export default function Honorarios() {
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
    if (orderBy !== "fechaHonorario") next.set("orderBy", orderBy);
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
      page,
      pageSize,
      search: debouncedSearch || undefined,
      from: from || undefined,
      to: to || undefined,
      sortBy: orderBy,
      sortDir: order,
      soloPendientes: soloPendientes || undefined,
    }),
    [page, pageSize, debouncedSearch, from, to, orderBy, order, soloPendientes]
  );

  const { data, isFetching, isError, error, refetch, isLoading } = useQuery({
    queryKey: ["honorarios", params],
    queryFn: fetchHonorariosFn,
    keepPreviousData: true,
    enabled: !!localStorage.getItem("token"),
  });

  const { data: valorJusHoyResp } = useQuery({
    queryKey: ["valor-jus-actual"],
    queryFn: getValorJusActual,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });
  const valorJusHoy = Number(valorJusHoyResp?.valor ?? valorJusHoyResp) || null;
  
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
        case "fechaRegulacion": {
          aVal = a.fechaRegulacion ? new Date(a.fechaRegulacion).getTime() : 0;
          bVal = b.fechaRegulacion ? new Date(b.fechaRegulacion).getTime() : 0;
          return (aVal - bVal) * dir;
        }
        case "jus": {
          aVal = Number(a.jus) || 0;
          bVal = Number(b.jus) || 0;
          return (aVal - bVal) * dir;
        }
        case "montoPesos": {
          aVal = computeImporteARS(a);
          bVal = computeImporteARS(b);
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          return (aVal - bVal) * dir;
        }
        case "cobrado": {
          aVal = getCobrado(a);
          bVal = getCobrado(b);
          return (aVal - bVal) * dir;
        }
        case "saldo": {
          aVal = getSaldoMostrado(a, valorJusHoy);
          bVal = getSaldoMostrado(b, valorJusHoy);
          if (aVal == null && bVal == null) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          return (aVal - bVal) * dir;
        }
        case "estado": {
          aVal = (a.estado?.nombre || "").toLowerCase();
          bVal = (b.estado?.nombre || "").toLowerCase();
          return aVal.localeCompare(bVal) * dir;
        }
        default:
          return 0;
      }
    });
  }, [rows, orderBy, order, valorJusHoy]);


  const handleSort = (prop) => {
    if (!["montoPesos", "saldo", "cliente", "caso", "fechaRegulacion", "jus", "cobrado", "estado"].includes(prop)) return;
    setPage(0);
    if (orderBy === prop) setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else { setOrderBy(prop); setOrder("asc"); }
  };

  const pedirConfirmarEliminar = (h) => {
    setConfirm({ open: true, id: h.id, name: h.descripcion || `Honorario #${h.id}` });
  };
  const cerrarConfirm = () => setConfirm({ open: false, id: null, name: "" });

  const confirmarEliminar = async () => {
    try {
      setDeletingId(confirm.id);
      await deleteHonorario(confirm.id);
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
      const { rows: todos } = await listHonorarios(paramsFull);

      const datos = todos.map((h) => ({
        "Fecha Regulación": fmtDate(h.fechaRegulacion),
        "Concepto": h.concepto?.nombre || h.concepto?.codigo || "",
        "Parte": h.parte?.nombre || h.parte?.codigo || "",
        "Moneda": monedaLabel(h),
        "Cantidad JUS": getCantJus(h) || "",
        "Valor JUS": h.valorJusRef ? Number(h.valorJusRef).toFixed(4) : "",
        "Importe ARS": formatCurrency(computeImporteARS(h), "ARS"),
        "Cobrado": formatCurrency(getCobrado(h), "ARS"),
        "Saldo": formatCurrency(getSaldo(h), "ARS"),
        "Estado": h.estado?.nombre || h.estado?.codigo || "",
        "Cliente": displayCliente(h.cliente),
        "Caso": displayExpte(h.caso),
      }));

      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Honorarios");
      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `honorarios_${fecha}.xlsx`);
      enqueueSnackbar("Excel exportado correctamente", { variant: "success" });
    } catch (e) {
      enqueueSnackbar("Error al exportar a Excel", { variant: "error" });
      console.error(e);
    }
  };

  // Acciones (como en Tareas.jsx)
  const crear = () => nav("/finanzas/honorarios/nuevo", { state: { from: location } });
  const editar = (id) => nav(`/finanzas/honorarios/editar/${id}`, { state: { from: location } });

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
        Honorarios
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
            <option value="montoPesos">Importe ($)</option>
            <option value="saldo">Saldo ($)</option>
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
        : sortedRows.map((h) => {
            const importe = computeImporteARS(h);
            const cantJus = getCantJus(h);
            const cobrado = getCobrado(h);
            const saldo   = getSaldoMostrado(h, valorJusHoy);

            return (
              <Paper key={h.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2, borderColor: "divider" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {displayCliente(h.cliente)}
                    </Typography>
                    {/*<Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Expte: {displayExpte(h.caso)}
                    </Typography>*/}

                    <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {/*  <Chip size="small" label={`Moneda: ${monedaLabel(h)}`} />*/}
                      <Chip size="small" label={`Importe: ${importe != null ? formatCurrency(importe, "ARS") : "—"}`} />
                    {/*  <Chip size="small" label={`Cant JUS: ${cantJus != null ? cantJus : "—"}`} />*/}
                      <Chip size="small" label={`Cobrado: ${formatCurrency(cobrado, "ARS")}`} />
                      <Chip
                        size="small"
                        color={Number(saldo) > 0 ? "warning" : "success"}
                        label={`Saldo: ${saldo != null ? formatCurrency(saldo, "ARS") : "—"}`}
                      />
                      {h.estado?.nombre && <Chip size="small" variant="outlined" label={h.estado.nombre} />}
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {canEditar && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => editar(h.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEliminar && (
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => pedirConfirmarEliminar(h)}
                          disabled={deletingId === h.id}
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
            No encontramos honorarios para mostrar.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.8 }}>
            Probá ajustar la búsqueda o creá un honorario nuevo.
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
            <TableCell sx={{ width: 130 }} sortDirection={orderBy === "fechaRegulacion" ? order : false}>
              <TableSortLabel
                active={orderBy === "fechaRegulacion"}
                direction={orderBy === "fechaRegulacion" ? order : "asc"}
                onClick={() => handleSort("fechaRegulacion")}
              >
                Fecha
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 140 }} align="right" sortDirection={orderBy === "jus" ? order : false}>
              <TableSortLabel
                active={orderBy === "jus"}
                direction={orderBy === "jus" ? order : "asc"}
                onClick={() => handleSort("jus")}
              >
                Cant JUS
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 150 }} sortDirection={orderBy === "montoPesos" ? order : false} align="right">
              <TableSortLabel
                active={orderBy === "montoPesos"}
                direction={orderBy === "montoPesos" ? order : "asc"}
                onClick={() => handleSort("montoPesos")}
              >
                Importe
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: 140 }} align="right" sortDirection={orderBy === "cobrado" ? order : false}>
              <TableSortLabel
                active={orderBy === "cobrado"}
                direction={orderBy === "cobrado" ? order : "asc"}
                onClick={() => handleSort("cobrado")}
              >
                Cobrado
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 150 }} sortDirection={orderBy === "saldo" ? order : false} align="center">
              <TableSortLabel
                active={orderBy === "saldo"}
                direction={orderBy === "saldo" ? order : "asc"}
                onClick={() => handleSort("saldo")}
              >
                Saldo
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 140 }} sortDirection={orderBy === "estado" ? order : false}>
              <TableSortLabel
                active={orderBy === "estado"}
                direction={orderBy === "estado" ? order : "asc"}
                onClick={() => handleSort("estado")}
              >
                Estado
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
                  <TableCell><Skeleton width="50%" /></TableCell>
                  <TableCell><Skeleton width="50%" /></TableCell>
                  <TableCell align="right"><Skeleton width="40%" /></TableCell>
                  <TableCell align="right"><Skeleton width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton width="60%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell align="right"><Skeleton width="90px" /></TableCell>
                </TableRow>
              ))
            : sortedRows.map((h) => {
                const importe = computeImporteARS(h);
                const cantJus = getCantJus(h);
                const cobrado = getCobrado(h);
                const saldo   = getSaldoMostrado(h, valorJusHoy);

                return (
                  <TableRow key={h.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {displayCliente(h.cliente)}
                    </TableCell>

                    <TableCell>{displayExpte(h.caso)}</TableCell>
                    <TableCell>{h.fechaRegulacion ? toDMYLocal(h.fechaRegulacion) : "—"}</TableCell>

                    <TableCell align="right">
                      {cantJus != null ? cantJus : "—"}
                    </TableCell>

                    <TableCell align="right">
                      {importe != null ? formatCurrency(importe, "ARS") : "—"}
                    </TableCell>

                    <TableCell align="right">
                      {formatCurrency(cobrado, "ARS")}
                    </TableCell>

                    <TableCell align="right">
                      {saldo != null
                        ? <Chip size="small" color={Number(saldo) > 0 ? "warning" : "success"} label={formatCurrency(saldo, "ARS")} />
                        : "—"}
                    </TableCell>

                    <TableCell>{h.estado?.nombre || "—"}</TableCell>

                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {canEditar && (
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => editar(h.id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEliminar && (
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => pedirConfirmarEliminar(h)}
                            disabled={deletingId === h.id}
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
              <TableCell colSpan={9}>
                <Box sx={{ py: 6, textAlign: "center", opacity: 0.8 }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    No encontramos honorarios para mostrar.
                  </Typography>
                  <Typography variant="body2">
                    Probá ajustar la búsqueda o creá un honorario nuevo.
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
          {error?.message || "Ocurrió un error al cargar los honorarios."}
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
          aria-label="Nuevo honorario"
        >
          <AddIcon sx={{ fontSize: 28 }} />
        </Fab>
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Eliminar honorario"
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
