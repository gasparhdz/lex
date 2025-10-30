// src/pages/Ingresos.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@mui/material/styles";
import { usePermisos } from "../auth/usePermissions";
import {
  Paper, Table, TableHead, TableRow, TableCell, TableBody, TableSortLabel,
  TablePagination, Box, TextField, InputAdornment, Button, IconButton,
  Tooltip, Alert, Skeleton, Typography, useMediaQuery, LinearProgress, Fab,Chip
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import * as XLSX from "xlsx";
import { enqueueSnackbar } from "notistack";

import { listIngresos, deleteIngreso } from "../api/finanzas/ingresos";
import { formatCurrency, toDMYLocal  } from "../utils/format";
import ConfirmDialog from "../components/ConfirmDialog";

/* ---------- helpers ---------- */
const DEFAULT_PAGESIZE = 10;

// debounce simple
function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const mapOrderBy = (s) => {
  switch (s) {
    case "fecha":
      return "fechaIngreso";
    case "creado":
      return "createdAt";
    case "actualizado":
      return "updatedAt";
    default:
      return "fechaIngreso";
  }
};

// preferimos total ARS con equivalencias si existen
const totalARS = (r) => {
  const mp = Number(r?.montoPesosEquivalente ?? 0);
  const vj = Number(r?.valorJusAlCobro ?? 0);
  const mj = Number(r?.montoJusEquivalente ?? 0);
  if (mp) return mp;
  if (vj && mj) return vj * mj;
  // fallback “crudo” si no hay equivalencias
  return Number(r?.monto ?? 0);
};

const displayCliente = (c) => {
  if (!c) return "Sin cliente";
  if (c.razonSocial?.trim()) return c.razonSocial.trim();
  const a = (c.apellido || "").trim();
  const n = (c.nombre || "").trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || "Sin nombre";
};
const getClienteKey = (row) =>
  (displayCliente(row.cliente) || "")
    .normalize?.("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

/* ---------- componente ---------- */
export default function Ingresos() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  
  // Verificaciones de permisos
  const { canCrear, canEditar, canEliminar } = usePermisos('FINANZAS');

  // estado UI
  const [page, setPage] = useState(0); // 0-based en UI
  const [pageSize, setPageSize] = useState(DEFAULT_PAGESIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 350);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // sortBy: 'fecha' | 'creado' | 'actualizado' (server) | 'monto' | 'cliente' (client)
  const [sortBy, setSortBy] = useState("fecha");
  const [sortDir, setSortDir] = useState("desc");


  // confirm eliminar
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" });
  const [deletingId, setDeletingId] = useState(null);

  const apiOrderBy = ["fecha", "creado", "actualizado"].includes(sortBy)
    ? mapOrderBy(sortBy)
    : undefined;
  const apiOrder = apiOrderBy ? sortDir : undefined;

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: debouncedSearch?.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      orderBy: apiOrderBy,
      order: apiOrder,
    }),
    [page, pageSize, debouncedSearch, from, to, apiOrderBy, apiOrder]
  );

  const { data, isFetching, isLoading, isError, error } = useQuery({
    queryKey: ["ingresos", params],
    queryFn: () => listIngresos(params),
    keepPreviousData: true,
    enabled: !!localStorage.getItem("token"),
  });

  const delMut = useMutation({
    mutationFn: (id) => deleteIngreso(id),
    onSuccess: () => {
      enqueueSnackbar?.("Ingreso eliminado", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["ingresos"] });
    },
    onError: (e) => {
      const msg =
        e?.response?.data?.publicMessage ||
        e?.response?.data?.message ||
        e?.message ||
        "Error eliminando";
      enqueueSnackbar?.(msg, { variant: "error" });
    },
  });

  const rows = data?.rows ?? data?.data ?? []; // por si quedó viejo el cliente
  const total = data?.total ?? 0;

  // ordenamiento local para 'monto' y 'cliente'
  const sortedRows = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    if (["monto", "cliente"].includes(sortBy)) {
      const dir = sortDir === "asc" ? 1 : -1;
      const copy = [...rows];

      if (sortBy === "cliente") {
        return copy.sort((a, b) => {
          const A = getClienteKey(a);
          const B = getClienteKey(b);
          if (!A && !B) return 0;
          if (!A) return 1;
          if (!B) return -1;
          return A.localeCompare(B) * dir;
        });
      }

      // monto ARS
      return copy.sort((a, b) => {
        const aN = Number(totalARS(a));
        const bN = Number(totalARS(b));
        const aNull = !Number.isFinite(aN);
        const bNull = !Number.isFinite(bN);
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        return (aN < bN ? -1 : 1) * dir;
      });
    }
    // para 'fecha/creado/actualizado' dejamos orden del server
    return rows;
  }, [rows, sortBy, sortDir]);

  const handleSort = (col) => {
    const serverAllowed = new Set(["fecha", "creado", "actualizado"]);
    const clientAllowed = new Set(["monto", "cliente"]);

    if (serverAllowed.has(col) || clientAllowed.has(col)) {
      if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortBy(col);
        setSortDir("asc");
      }
      setPage(0);
    }
  };

  const onCrear = () =>
    nav("/finanzas/ingresos/nuevo", { state: { from: "/finanzas?tab=ingresos" } });
  
  const onEditar = (row) =>
    nav(`/finanzas/ingresos/editar/${row.id}`, { state: { from: "/finanzas?tab=ingresos" } });
  
  const pedirConfirmarEliminar = (row) =>
    setConfirm({
      open: true,
      id: row.id,
      name: row.descripcion || `Ingreso #${row.id}`,
    });
  const cerrarConfirm = () => setConfirm({ open: false, id: null, name: "" });
  const confirmarEliminar = async () => {
    try {
      setDeletingId(confirm.id);
      await delMut.mutateAsync(confirm.id);
    } finally {
      setDeletingId(null);
      cerrarConfirm();
    }
  };

  // Exportar a Excel
  const handleExportExcel = async () => {
    try {
      const paramsFull = { ...params, pageSize: 10000, page: 1 };
      const { rows: todos = data?.rows || [] } = await listIngresos(paramsFull);

      const datos = todos.map((i) => ({
        "Fecha": i.fechaIngreso ? new Date(i.fechaIngreso).toLocaleDateString() : "",
        "Descripción": i.descripcion || "",
        "Concepto": i.tipo?.nombre || i.tipo?.codigo || "",
        "Monto": i.monto ? Number(i.monto).toFixed(2) : "",
        "Moneda": i.moneda?.nombre || i.moneda?.codigo || "",
        "Valor JUS Al Cobro": i.valorJusAlCobro ? Number(i.valorJusAlCobro).toFixed(4) : "",
        "Equivalente JUS": i.montoJusEquivalente ? Number(i.montoJusEquivalente).toFixed(4) : "",
        "Equivalente ARS": i.montoPesosEquivalente ? Number(i.montoPesosEquivalente).toFixed(2) : "",
        "Estado": i.estado?.nombre || i.estado?.codigo || "",
        "Cliente": displayCliente(i.cliente),
        "Caso": displayExpte(i.caso),
      }));

      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ingresos");
      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `ingresos_${fecha}.xlsx`);
      enqueueSnackbar("Excel exportado correctamente", { variant: "success" });
    } catch (e) {
      enqueueSnackbar("Error al exportar a Excel", { variant: "error" });
      console.error(e);
    }
  };

  /* ---------- Header (mobile/desktop) ---------- */
  const DesktopHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>


        <TextField
          size="small"
          placeholder="Buscar por descripción, cliente, expte…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
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
            size="small"
            type="date"
            label="Desde"
            InputLabelProps={{ shrink: true }}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            type="date"
            label="Hasta"
            InputLabelProps={{ shrink: true }}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
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
            <Button variant="contained" startIcon={<AddIcon />} onClick={onCrear} sx={{ textTransform: "none" }}>
              Nuevo
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );

  const MobileHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, mb: 1 }}>
        Ingresos
      </Typography>

      <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por descripción, cliente, expte…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
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
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(0);
          }}
        />
        <TextField
          size="small"
          type="date"
          label="Hasta"
          InputLabelProps={{ shrink: true }}
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(0);
          }}
        />

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            select
            size="small"
            label="Ordenar por"
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setSortDir("asc");
              setPage(0);
            }}
            sx={{ flex: 1, minWidth: 160 }}
            SelectProps={{ native: true }}
          >
            <option value="fecha">Fecha</option>
            <option value="monto">Monto (ARS)</option>
            <option value="cliente">Cliente (A–Z)</option>
            <option value="creado">Creado</option>
            <option value="actualizado">Actualizado</option>
          </TextField>
          <IconButton
            size="small"
            onClick={() => setSortDir((o) => (o === "asc" ? "desc" : "asc"))}
            aria-label="Cambiar orden"
            sx={{ border: 1, borderColor: "divider" }}
          >
            {sortDir === "asc" ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  const Header = isMobile ? MobileHeader : DesktopHeader;
  const ProgressBar =
    isFetching || isLoading ? <LinearProgress sx={{ mb: 1, borderRadius: 1 }} /> : null;

  /* ---------- Tabla (desktop) ---------- */
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
            <TableCell sx={{ width: 140 }} sortDirection={sortBy === "fecha" ? sortDir : false}>
              <TableSortLabel
                active={sortBy === "fecha"}
                direction={sortBy === "fecha" ? sortDir : "asc"}
                onClick={() => handleSort("fecha")}
              >
                Fecha
              </TableSortLabel>
            </TableCell>

            <TableCell>Descripción</TableCell>

            <TableCell sx={{ width: 260 }} sortDirection={sortBy === "cliente" ? sortDir : false}>
              <TableSortLabel
                active={sortBy === "cliente"}
                direction={sortBy === "cliente" ? sortDir : "asc"}
                onClick={() => handleSort("cliente")}
              >
                Cliente / Expte
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 160 }}>Tipo</TableCell>

            <TableCell sx={{ width: 160 }} align="right" sortDirection={sortBy === "monto" ? sortDir : false}>
              <TableSortLabel
                active={sortBy === "monto"}
                direction={sortBy === "monto" ? sortDir : "asc"}
                onClick={() => handleSort("monto")}
              >
                Monto (ARS)
              </TableSortLabel>
            </TableCell>

            <TableCell align="center" sx={{ width: 120, whiteSpace: "nowrap" }}>
              Acciones
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {isFetching && rows.length === 0
            ? Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell><Skeleton width={90} /></TableCell>
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell><Skeleton width="70%" /></TableCell>
                  <TableCell><Skeleton width={100} /></TableCell>
                  <TableCell align="right"><Skeleton width={80} /></TableCell>
                  <TableCell align="center"><Skeleton width={100} /></TableCell>
                </TableRow>
              ))
            : (sortedRows.length ? sortedRows : rows).map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>{toDMYLocal(r.fechaIngreso)}</TableCell>

                  <TableCell sx={{ maxWidth: 420, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {r.descripcion || "-"}
                  </TableCell>

                  <TableCell sx={{ maxWidth: 420, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
                    {displayCliente(r.cliente)}
                    {r.caso ? ` — Expte ${r.caso.nroExpte}` : ""}
                  </TableCell>

                  <TableCell>{r.tipo?.nombre || r.tipo?.codigo || "-"}</TableCell>

                  <TableCell align="right">{formatCurrency(totalARS(r), "ARS")}</TableCell>

                  <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                    {canEditar && (
                      <Tooltip title="Editar">
                        <IconButton onClick={() => onEditar(r)} size="small">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEliminar && (
                      <Tooltip title="Eliminar">
                        <IconButton
                          onClick={() => pedirConfirmarEliminar(r)}
                          size="small"
                          color="error"
                          disabled={deletingId === r.id}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}

          {!isFetching && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                Sin resultados
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );

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
        : sortedRows.map((r) => (
            <Paper
              key={r.id}
              variant="outlined"
              sx={{ p: 1.25, borderRadius: 2, borderColor: "divider" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {displayCliente(r.cliente)}
                    {r.caso ? ` · Expte: ${r.caso.nroExpte}` : ""}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.75 }}>
                    Fecha: {toDMYLocal(r.fechaIngreso)}
                  </Typography>

                  <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {r.tipo?.nombre && (
                      <Chip size="small" variant="outlined" label={r.tipo.nombre} />
                    )}
                    <Chip
                      size="small"
                      color="info"
                      label={`Monto: ${formatCurrency(totalARS(r), "ARS")}`}
                    />
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {canEditar && (
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => onEditar(r)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEliminar && (
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => pedirConfirmarEliminar(r)}
                        disabled={deletingId === r.id}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Paper>
          ))}

      {!isFetching && rows.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="body1" sx={{ mb: 0.5 }}>
            No encontramos ingresos para mostrar.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.8 }}>
            Probá ajustar la búsqueda o creá un ingreso nuevo.
          </Typography>
          <Button variant="contained" size="small" onClick={onCrear}>
            Nuevo
          </Button>
        </Paper>
      )}
    </Box>
  );

  return (
    <Box>
      {Header}
      {(isFetching || isLoading) && ProgressBar}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.response?.data?.publicMessage ||
            error?.response?.data?.message ||
            error?.message ||
            "Error cargando ingresos"}
        </Alert>
      )}

      {isMobile ? MobileList : DesktopTable}

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_e, newPage) => setPage(newPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setPageSize(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage="Filas por página"
        sx={{ mt: 1 }}
      />

      {/* FAB "Nuevo" en mobile */}
      {isMobile && (
        <Fab
          color="primary"
          onClick={onCrear}
          sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 1200, width: 64, height: 64, boxShadow: 5 }}
          aria-label="Nuevo ingreso"
        >
          <AddIcon sx={{ fontSize: 28 }} />
        </Fab>
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Eliminar ingreso"
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
