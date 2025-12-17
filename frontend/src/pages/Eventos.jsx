// src/pages/Eventos.jsx
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import { usePermisos } from "../auth/usePermissions";
import {
  Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Box, TextField, InputAdornment,
  TableSortLabel, TablePagination, Alert, Skeleton, Tooltip, Button, IconButton, Fab,
  useMediaQuery, LinearProgress, MenuItem, Chip
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { enqueueSnackbar } from "notistack";
import ConfirmDialog from "../components/ConfirmDialog";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import * as XLSX from "xlsx";

/* ---------- helpers ---------- */
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

async function fetchEventosFn({ queryKey }) {
  const [_key, params] = queryKey;
  const { data } = await api.get("/eventos", { params });
  return data; // { data: [], total, page, pageSize }
}

async function fetchTiposEvento() {
  const { data } = await api.get("/parametros", { params: { categoria: "TIPO_EVENTO", activo: true } });
  return Array.isArray(data) ? data : data?.data ?? [];
}
async function fetchEstadosEvento() {
  const { data } = await api.get("/parametros", { params: { categoria: "ESTADO_EVENTO", activo: true } });
  return Array.isArray(data) ? data : data?.data ?? [];
}

const displayCliente = (c) => {
  if (!c) return "Sin cliente";
  if (c.razonSocial?.trim()) return c.razonSocial.trim();
  const a = (c.apellido || "").trim();
  const n = (c.nombre || "").trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || "Sin nombre";
};

// Mostrar solo número de expediente (o fallback)
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
  return n || (caso.id ? `#${caso.id}` : "-");
};

const fmtDateTime = (d, allDay = false) => {
  if (!d) return "-";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "-";
  return allDay ? dt.toLocaleDateString() : dt.toLocaleString();
};
const fmtDateRange = (start, end, allDay = false) => {
  if (!start && !end) return "-";
  const s = fmtDateTime(start, allDay);
  const e = end ? ` – ${fmtDateTime(end, allDay)}` : "";
  return `${s}${e}`;
};

const isVencido = (e) => {
  if (!e.fechaInicio) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaInicio = new Date(e.fechaInicio);
  fechaInicio.setHours(0, 0, 0, 0);
  return fechaInicio < hoy && e.estado?.nombre?.toLowerCase() === "pendiente";
};

function labelEstado(key) {
  const k = (key || "").toString().toLowerCase();
  switch (k) {
    case "pendiente": return "Pendiente";
    case "en_proceso": return "En proceso";
    case "finalizado": return "Finalizado";
    case "cancelado": return "Cancelado";
    default: return key || "—";
  }
}
function colorEstado(key) {
  const k = (key || "").toString().toLowerCase();
  switch (k) {
    case "pendiente": return "default";
    case "en_proceso": return "info";
    case "finalizado": return "success";
    case "cancelado": return "error";
    default: return "default";
  }
}

const toInt = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const toOrder = (v) => (v === "desc" ? "desc" : "asc");
const toOrderBy = (v) => {
  if (!v) return "fechaInicio";
  return ["fechaInicio", "descripcion", "cliente", "caso", "tipo", "estado"].includes(v) ? v : "fechaInicio";
};

/* ---------- componente ---------- */
export default function Eventos() {
  const nav = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCrear, canEditar, canEliminar } = usePermisos('EVENTOS');

  // Estado inicial tomado de la URL
  const [page, setPage] = useState(toInt(searchParams.get("page"), 0));
  const [pageSize, setPageSize] = useState(toInt(searchParams.get("pageSize"), 10));
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const [orderBy, setOrderBy] = useState(toOrderBy(searchParams.get("orderBy")));
  const [order, setOrder] = useState(toOrder(searchParams.get("order")));
  
  // Filtros
  const [tipoId, setTipoId] = useState(searchParams.get("tipoId") ?? "");     // "" = todos
  const [estadoId, setEstadoId] = useState(searchParams.get("estadoId") ?? ""); // "" = todos
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos-evento"], queryFn: fetchTiposEvento, staleTime: 5 * 60 * 1000 });
  const { data: estados = [] } = useQuery({ queryKey: ["estados-evento"], queryFn: fetchEstadosEvento, staleTime: 5 * 60 * 1000 });

  // Mantener URL en sync
  useEffect(() => {
    const next = new URLSearchParams();
    if (page) next.set("page", String(page));
    if (pageSize !== 10) next.set("pageSize", String(pageSize));
    if (debouncedSearch?.trim()) next.set("search", debouncedSearch.trim());
    if (orderBy !== "fechaInicio") next.set("orderBy", orderBy);
    if (order !== "asc") next.set("order", order);
    if (tipoId) next.set("tipoId", tipoId);
    if (estadoId) next.set("estadoId", estadoId);

    const changed = next.toString() !== searchParams.toString();
    if (changed) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, orderBy, order, tipoId, estadoId]);

  // Si cambian externamente los searchParams, actualizamos el estado local
  useEffect(() => {
    setPage(toInt(searchParams.get("page"), 0));
    setPageSize(toInt(searchParams.get("pageSize"), 10));
    setSearch(searchParams.get("search") ?? "");
    setOrderBy(toOrderBy(searchParams.get("orderBy")));
    setOrder(toOrder(searchParams.get("order")));
    setTipoId(searchParams.get("tipoId") ?? "");
    setEstadoId(searchParams.get("estadoId") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const [deletingId, setDeletingId] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" });

  const params = useMemo(
    () => ({
      page: page + 1,
      pageSize,
      search: debouncedSearch || undefined,
      orderBy,
      order,
      tipoId: tipoId ? Number(tipoId) : undefined,
      estadoId: estadoId ? Number(estadoId) : undefined,
    }),
    [page, pageSize, debouncedSearch, orderBy, order, tipoId, estadoId]
  );

  const { data, isFetching, isError, error, refetch, isLoading } = useQuery({
    queryKey: ["eventos", params],
    queryFn: fetchEventosFn,
    keepPreviousData: true,
    enabled: !!localStorage.getItem("token"),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleSort = (prop) => {
    if (!["fechaInicio", "descripcion", "cliente", "caso", "tipo", "estado"].includes(prop)) return;
    setPage(0);
    if (orderBy === prop) setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setOrderBy(prop);
      setOrder("asc");
    }
  };

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setPageSize(parseInt(e.target.value, 10));
    setPage(0);
  };

  // Acciones
  const editar = (id) => nav(`/eventos/editar/${id}`, { state: { from: location } });
  const pedirConfirmarEliminar = (ev) => {
    const nombre = ev.descripcion?.trim() || ev.tipo?.nombre || ev.tipo?.codigo || `Evento #${ev.id}`;
    setConfirm({ open: true, id: ev.id, name: nombre });
  };
  const cerrarConfirm = () => setConfirm({ open: false, id: null, name: "" });

  const confirmarEliminar = async () => {
    try {
      setDeletingId(confirm.id);
      await api.delete(`/eventos/${confirm.id}`);
      enqueueSnackbar("Evento eliminado", { variant: "success" });
      cerrarConfirm();
      refetch();
    } catch (e) {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "No se pudo eliminar el evento";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  // Exportar a Excel
  const handleExportExcel = async () => {
    try {
      const paramsFull = {
        ...params,
        pageSize: 10000,
        page: 1,
      };
      
      const { data } = await api.get("/eventos", { params: paramsFull });
      const todos = data?.data ?? [];

      const datos = todos.map((e) => ({
        "Descripción": e.descripcion || "",
        "Tipo": e.tipo?.nombre || "",
        "Estado": e.estado?.nombre || "",
        "Fecha Inicio": e.fechaInicio ? new Date(e.fechaInicio).toLocaleString() : "",
        "Fecha Fin": e.fechaFin ? new Date(e.fechaFin).toLocaleString() : "",
        "Todo el día": e.allDay ? "Sí" : "No",
        "Cliente": displayCliente(e.cliente || e.caso?.cliente),
        "Caso": displayExpte(e.caso),
      }));

      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Eventos");

      const fecha = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `eventos_${fecha}.xlsx`;

      XLSX.writeFile(wb, nombreArchivo);
      enqueueSnackbar("Excel exportado correctamente", { variant: "success" });
    } catch (e) {
      enqueueSnackbar("Error al exportar a Excel", { variant: "error" });
      console.error(e);
    }
  };

  /* ---------- Header (mobile y desktop) ---------- */

  // Desktop: Título, búsqueda, filtros, botón
  const DesktopHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, minWidth: { xs: "100%", md: "auto" } }}>
          Eventos
        </Typography>

        <TextField
          size="small"
          placeholder="Buscar por descripción, cliente o expte…"
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
            select size="small" label="Tipo" value={tipoId}
            onChange={(e) => { setTipoId(e.target.value); setPage(0); }}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {tipos.map((t) => (
              <MenuItem key={t.id} value={String(t.id)}>{t.nombre || t.codigo}</MenuItem>
            ))}
          </TextField>

          <TextField
            select size="small" label="Estado" value={estadoId}
            onChange={(e) => { setEstadoId(e.target.value); setPage(0); }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {estados.map((e) => (
              <MenuItem key={e.id} value={String(e.id)}>{e.nombre || e.codigo}</MenuItem>
            ))}
          </TextField>

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
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => nav("/eventos/nuevo", { state: { from: "/eventos" } })}
              sx={{ textTransform: "none" }}
            >
              Nuevo
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );

  // Mobile: Buscador primero, luego filtros
  const MobileHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, mb: 1 }}>
        Eventos
      </Typography>

      <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por descripción, cliente o expte…"
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
          select size="small" label="Tipo" value={tipoId}
          onChange={(e) => { setTipoId(e.target.value); setPage(0); }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {tipos.map((t) => (
            <MenuItem key={t.id} value={String(t.id)}>{t.nombre || t.codigo}</MenuItem>
          ))}
        </TextField>

        <TextField
          select size="small" label="Estado" value={estadoId}
          onChange={(e) => { setEstadoId(e.target.value); setPage(0); }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {estados.map((e) => (
            <MenuItem key={e.id} value={String(e.id)}>{e.nombre || e.codigo}</MenuItem>
          ))}
        </TextField>

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            select size="small" label="Ordenar por"
            value={orderBy} onChange={(e) => handleSort(e.target.value)}
            sx={{ flex: 1, minWidth: 160 }}
          >
            <MenuItem value="fechaInicio">Fecha inicio</MenuItem>
            <MenuItem value="descripcion">Descripción</MenuItem>
            <MenuItem value="createdAt">Creación</MenuItem>
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
      </Box>
    </Box>
  );

  const Header = isMobile ? MobileHeader : DesktopHeader;

  const ProgressBar = (isFetching || isLoading) ? (
    <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
  ) : null;

  /* ---------- Mobile list ---------- */
  const MobileList = (
    <Box sx={{ display: "grid", gap: 1.25, width: "100%", maxWidth: "100%", overflowX: "hidden" }}>
      {isFetching && rows.length === 0
        ? Array.from({ length: 6 }).map((_, i) => (
            <Paper key={`m-skel-${i}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Skeleton width="50%" />
            </Paper>
          ))
        : rows.map((e) => {
            const nombre = e.descripcion?.trim() || e.tipo?.nombre || e.tipo?.codigo || `Evento #${e.id}`;
            return (
              <Paper
                key={e.id}
                variant="outlined"
                sx={{
                    p: 1.25,
                    borderRadius: 2,
                    borderColor: "divider",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    overflow: "hidden",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0, width: "100%" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, minWidth: 0 }}>
                        {nombre}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9, whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                        Cliente: {displayCliente(e.cliente || e.caso?.cliente)}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.9, overflowWrap: "anywhere" }}>
                        Expte: {displayExpte(e.caso)}
                        </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.7 }}>
                      Fecha: {fmtDateRange(e.fechaInicio, e.fechaFin, e.allDay)}
                    </Typography>
                    <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Chip size="small" label={e.tipo?.nombre || e.tipo?.codigo || "—"} />
                      <Chip
                        size="small"
                        label={labelEstado(e.estado?.nombre || e.estado?.codigo || e.estado)}
                        color={colorEstado(e.estado?.nombre || e.estado?.codigo || e.estado)}
                        variant="outlined"
                      />
                      {e.allDay ? <Chip size="small" label="Todo el día" /> : null}
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    {canEditar && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => editar(e.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEliminar && (
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => pedirConfirmarEliminar(e)}
                          disabled={deletingId === e.id}
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
            No encontramos eventos para mostrar.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.8 }}>
            Probá ajustar la búsqueda o creá un evento nuevo.
          </Typography>
          {canCrear && (
            <Button variant="contained" size="small" onClick={() => nav("/eventos/nuevo", { state: { from: "/eventos" } })}>
              Nuevo
            </Button>
          )}
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
          tableLayout: "auto",
          "& td, & th": {
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
            verticalAlign: "middle",
            lineHeight: 1.6,
            whiteSpace: "normal",
            wordBreak: "break-word",
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
            <TableCell sx={{ width: 300 }} sortDirection={orderBy === "descripcion" ? order : false}>
              <TableSortLabel
                active={orderBy === "descripcion"}
                direction={orderBy === "descripcion" ? order : "asc"}
                onClick={() => handleSort("descripcion")}
              >
                Descripción
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 200 }} sortDirection={orderBy === "cliente" ? order : false}>
              <TableSortLabel
                active={orderBy === "cliente"}
                direction={orderBy === "cliente" ? order : "asc"}
                onClick={() => handleSort("cliente")}
              >
                Cliente
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: 130 }} sortDirection={orderBy === "caso" ? order : false}>
              <TableSortLabel
                active={orderBy === "caso"}
                direction={orderBy === "caso" ? order : "asc"}
                onClick={() => handleSort("caso")}
              >
                Expte
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 150 }} sortDirection={orderBy === "tipo" ? order : false}>
              <TableSortLabel
                active={orderBy === "tipo"}
                direction={orderBy === "tipo" ? order : "asc"}
                onClick={() => handleSort("tipo")}
              >
                Tipo
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: 100 }} sortDirection={orderBy === "estado" ? order : false}>
              <TableSortLabel
                active={orderBy === "estado"}
                direction={orderBy === "estado" ? order : "asc"}
                onClick={() => handleSort("estado")}
              >
                Estado
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 160 }} sortDirection={orderBy === "fechaInicio" ? order : false}>
              <TableSortLabel
                active={orderBy === "fechaInicio"}
                direction={orderBy === "fechaInicio" ? order : "asc"}
                onClick={() => handleSort("fechaInicio")}
              >
                Fecha
              </TableSortLabel>
            </TableCell>

            <TableCell align="right" sx={{ width: 110, whiteSpace: "nowrap" }}>
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
                  <TableCell><Skeleton width="70%" /></TableCell>
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton width="120px" /></TableCell>
                </TableRow>
              ))
            : rows.map((e) => {
                const nombre = e.descripcion?.trim() || e.tipo?.nombre || e.tipo?.codigo || `Evento #${e.id}`;
                const vencido = isVencido(e);
                return (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {nombre}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {displayCliente(e.cliente || e.caso?.cliente)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {displayExpte(e.caso)}
                    </TableCell>
                    <TableCell>{e.tipo?.nombre || e.tipo?.codigo || "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={labelEstado(e.estado?.nombre || e.estado?.codigo || e.estado)}
                        color={colorEstado(e.estado?.nombre || e.estado?.codigo || e.estado)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{fmtDateRange(e.fechaInicio, e.fechaFin, e.allDay)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {canEditar && (
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => editar(e.id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEliminar && (
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => pedirConfirmarEliminar(e)}
                            disabled={deletingId === e.id}
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
              <TableCell colSpan={7}>
                <Box sx={{ py: 6, textAlign: "center", opacity: 0.8 }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    No encontramos eventos para mostrar.
                  </Typography>
                  <Typography variant="body2">
                    Probá ajustar la búsqueda o creá un evento nuevo.
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
    <Paper
      elevation={0}
      sx={{
        mt: 2,
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => (t.palette.mode === "dark" ? "background.paper" : "#fff"),
        overflowX: "hidden",
      }}
    >
      {Header}
      {ProgressBar}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || "Ocurrió un error al cargar los eventos."}
        </Alert>
      )}

      {isMobile ? MobileList : DesktopTable}

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={pageSize}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage="Filas por página"
        sx={{ mt: 1 }}
      />

      {/* FAB "Nuevo" en mobile */}
      {isMobile && canCrear && (
        <Fab
          color="primary"
          onClick={() => nav("/eventos/nuevo", { state: { from: "/eventos" } })}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 1200,
            width: 64,
            height: 64,
            boxShadow: 5,
          }}
          aria-label="Nuevo evento"
        >
          <AddIcon sx={{ fontSize: 28 }} />
        </Fab>
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Eliminar evento"
        description={`¿Seguro que querés eliminar “${confirm.name}”? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmColor="error"
        loading={deletingId === confirm.id}
        onClose={cerrarConfirm}
        onConfirm={confirmarEliminar}
      />
    </Paper>
  );
}
