// src/pages/Tareas.jsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import * as XLSX from "xlsx";

/* ---------- helpers ---------- */
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

async function fetchTareasFn({ queryKey }) {
  const [_key, params] = queryKey;
  const { data } = await api.get("/tareas", { params });
  return data; // { data: [], total, page, pageSize }
}

async function fetchPrioridades() {
  // categoriaId = 7 en backend (ya lo usa api/tareas.js)
  const { data } = await api.get("/parametros", { params: { categoriaId: 7, activo: true } });
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

// helper para cortar a N líneas con elipsis
const clampLines = (lines) => ({
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: lines,
  overflow: "hidden",
  textOverflow: "ellipsis",
});

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

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "-");

const isVencida = (t) => {
  if (t.completada) return false;
  if (!t.fechaLimite) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(t.fechaLimite);
  limite.setHours(0, 0, 0, 0);
  return limite < hoy;
};

/* ---------- componente ---------- */
export default function Tareas() {
  const nav = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { canCrear, canEditar, canEliminar } = usePermisos('TAREAS');
  const queryClient = useQueryClient();

  // Estado UI
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);

  // Filtros
  const [prioridadId, setPrioridadId] = useState(""); // "" = todas
  const [completada, setCompletada] = useState("");   // ""=todas, "true", "false"
  const { data: prioridades = [] } = useQuery({ queryKey: ["prioridades-tarea"], queryFn: fetchPrioridades, staleTime: 5 * 60 * 1000 });

  // Orden
  const [orderBy, setOrderBy] = useState("fechaLimite");
  const [order, setOrder] = useState("asc");

  const [deletingId, setDeletingId] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" });

  const params = useMemo(
    () => ({
      page: page + 1,
      pageSize,
      search: debouncedSearch || undefined,
      orderBy,
      order,
      prioridadId: prioridadId ? Number(prioridadId) : undefined,
      completada: completada === "" ? undefined : completada === "true",
    }),
    [page, pageSize, debouncedSearch, orderBy, order, prioridadId, completada]
  );

  const { data, isFetching, isError, error, refetch, isLoading } = useQuery({
    queryKey: ["tareas", params],
    queryFn: fetchTareasFn,
    keepPreviousData: true,
    enabled: !!localStorage.getItem("token"),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleSort = (prop) => {
    if (!["fechaLimite", "titulo", "createdAt"].includes(prop)) return;
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
  const editar = (id) => nav(`/tareas/editar/${id}`, { state: { from: "/tareas" } });
  const pedirConfirmarEliminar = (t) => {
    setConfirm({ open: true, id: t.id, name: t.titulo });
  };
  const cerrarConfirm = () => setConfirm({ open: false, id: null, name: "" });

  const confirmarEliminar = async () => {
    try {
      setDeletingId(confirm.id);
      await api.delete(`/tareas/${confirm.id}`);
      enqueueSnackbar("Tarea eliminada", { variant: "success" });
      cerrarConfirm();
      refetch();
    } catch (e) {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "No se pudo eliminar la tarea";
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
      
      const { data } = await api.get("/tareas", { params: paramsFull });
      const todos = data?.data ?? [];

      const datos = todos.map((t) => ({
        "Título": t.titulo || "",
        "Descripción": t.descripcion || "",
        "Completada": t.completada ? "Sí" : "No",
        "Fecha Límite": t.fechaLimite ? new Date(t.fechaLimite).toLocaleDateString() : "",
        "Recordatorio": t.recordatorio ? new Date(t.recordatorio).toLocaleDateString() : "",
        "Prioridad": t.prioridad?.nombre || "",
        "Cliente": displayCliente(t.cliente),
        "Caso": displayExpte(t.caso),
        "Fecha Completada": t.completadaAt ? new Date(t.completadaAt).toLocaleDateString() : "",
      }));

      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tareas");

      const fecha = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `tareas_${fecha}.xlsx`;

      XLSX.writeFile(wb, nombreArchivo);
      enqueueSnackbar("Excel exportado correctamente", { variant: "success" });
    } catch (e) {
      enqueueSnackbar("Error al exportar a Excel", { variant: "error" });
      console.error(e);
    }
  };

  // Mutación para marcar como completada
  const toggleCompletadaMut = useMutation({
    mutationFn: async ({ tareaId, completada }) => {
      await api.put(`/tareas/${tareaId}`, { completada, completadaAt: completada ? new Date().toISOString() : null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      enqueueSnackbar("Tarea actualizada", { variant: "success" });
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || "Error al actualizar la tarea";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleToggleCompletada = async (tarea) => {
    toggleCompletadaMut.mutate({ tareaId: tarea.id, completada: !tarea.completada });
  };

  /* ---------- Header (mobile y desktop) ---------- */

  // Desktop: Título, búsqueda, filtros, botón
  const DesktopHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, minWidth: { xs: "100%", md: "auto" } }}>
          Tareas
        </Typography>

        <TextField
          size="small"
          placeholder="Buscar por título, cliente o expte…"
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
            select size="small" label="Prioridad" value={prioridadId}
            onChange={(e) => { setPrioridadId(e.target.value); setPage(0); }}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {prioridades.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>{p.nombre || p.codigo}</MenuItem>
            ))}
          </TextField>

          <TextField
            select size="small" label="Completada" value={completada}
            onChange={(e) => { setCompletada(e.target.value); setPage(0); }}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="false">No</MenuItem>
            <MenuItem value="true">Sí</MenuItem>
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
              onClick={() => nav("/tareas/nuevo")}
              sx={{ textTransform: "none" }}
            >
              Nueva
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
        Tareas
      </Typography>

      <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por título, cliente o expte…"
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
          select size="small" label="Prioridad" value={prioridadId}
          onChange={(e) => { setPrioridadId(e.target.value); setPage(0); }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {prioridades.map((p) => (
            <MenuItem key={p.id} value={String(p.id)}>{p.nombre || p.codigo}</MenuItem>
          ))}
        </TextField>

        <TextField
          select size="small" label="Completada" value={completada}
          onChange={(e) => { setCompletada(e.target.value); setPage(0); }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">Todas</MenuItem>
          <MenuItem value="false">No</MenuItem>
          <MenuItem value="true">Sí</MenuItem>
        </TextField>

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            select size="small" label="Ordenar por"
            value={orderBy} onChange={(e) => handleSort(e.target.value)}
            sx={{ flex: 1, minWidth: 160 }}
          >
            <MenuItem value="fechaLimite">Fecha límite</MenuItem>
            <MenuItem value="titulo">Título</MenuItem>
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
    <Box sx={{ display: "grid", gap: 1.25, px: 1, overflowX: "hidden" }}>
      {isFetching && rows.length === 0
        ? Array.from({ length: 6 }).map((_, i) => (
            <Paper key={`m-skel-${i}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Skeleton width="50%" />
            </Paper>
          ))
        : rows.map((t) => (
            <Paper
              key={t.id}
              variant="outlined"
              sx={{
                p: 1.25,
                borderRadius: 2,
                borderColor: "divider",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
                mx: 0,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, ...clampLines(2) }}>
                    {t.titulo}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Cliente: {displayCliente(t.cliente)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Expte: {displayExpte(t.caso)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Límite: {fmtDateTime(t.fechaLimite)}
                  </Typography>
                  <Box sx={{ mt: 0.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Chip size="small" label={t.prioridad?.nombre || t.prioridad?.codigo || "—"} />
                    <Chip
                      size="small"
                      icon={t.completada ? <CheckCircleIcon /> : <CancelIcon />}
                      label={t.completada ? "Completada" : "Pendiente"}
                      color={t.completada ? "success" : "warning"}
                      variant={t.completada ? "filled" : "outlined"}
                    />
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {canEditar && (
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => editar(t.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEliminar && (
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => pedirConfirmarEliminar(t)}
                        disabled={deletingId === t.id}
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
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderRadius: 2, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          <Typography variant="body1" sx={{ mb: 0.5 }}>
            No encontramos tareas para mostrar.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.8 }}>
            Probá ajustar la búsqueda o creá una tarea nueva.
          </Typography>
          {canCrear && (
            <Button variant="contained" size="small" onClick={() => nav("/tareas/nuevo")}>
              Nueva
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
            <TableCell sx={{ width: 360 }} sortDirection={orderBy === "titulo" ? order : false}>
              <TableSortLabel
                active={orderBy === "titulo"}
                direction={orderBy === "titulo" ? order : "asc"}
                onClick={() => handleSort("titulo")}
              >
                Título
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 240 }}>Cliente</TableCell>
            <TableCell sx={{ width: 160 }}>Expte</TableCell>

            <TableCell sx={{ width: 110 }}>Prioridad</TableCell>

            <TableCell sx={{ width: 110 }}>Completada</TableCell>

            <TableCell sx={{ width: 170 }} sortDirection={orderBy === "fechaLimite" ? order : false}>
              <TableSortLabel
                active={orderBy === "fechaLimite"}
                direction={orderBy === "fechaLimite" ? order : "asc"}
                onClick={() => handleSort("fechaLimite")}
              >
                Fecha límite
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
                  <TableCell><Skeleton width="70%" /></TableCell>
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell align="right"><Skeleton width="120px" /></TableCell>
                </TableRow>
              ))
            : rows.map((t) => {
                const vencida = isVencida(t);
                const status = t.completada ? "Completada" : vencida ? "Vencida" : "No completada";
                return (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.titulo}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayCliente(t.cliente)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {displayExpte(t.caso)}
                  </TableCell>
                  <TableCell>{t.prioridad?.nombre || t.prioridad?.codigo || "—"}</TableCell>
                  <TableCell onClick={() => canEditar && handleToggleCompletada(t)} sx={{ cursor: canEditar ? "pointer" : "default" }}>
                    <Chip
                      size="small"
                      icon={t.completada ? <CheckCircleIcon /> : vencida ? <CancelIcon /> : <CancelIcon />}
                      label={status}
                      color={t.completada ? "success" : vencida ? "error" : "warning"}
                      variant={t.completada ? "filled" : vencida ? "filled" : "outlined"}
                    />
                  </TableCell>
                  <TableCell>{fmtDateTime(t.fechaLimite)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {canEditar && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => editar(t.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEliminar && (
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => pedirConfirmarEliminar(t)}
                          disabled={deletingId === t.id}
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
                    No encontramos tareas para mostrar.
                  </Typography>
                  <Typography variant="body2">
                    Probá ajustar la búsqueda o creá una tarea nueva.
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
          {error?.message || "Ocurrió un error al cargar las tareas."}
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

      {/* FAB "Nueva" en mobile */}
      {isMobile && canCrear && (
        <Fab
          color="primary"
          onClick={() => nav("/tareas/nuevo", { state: { from: "/tareas" } })}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 1200,
            width: 64,
            height: 64,
            boxShadow: 5,
          }}
          aria-label="Nueva tarea"
        >
          <AddIcon sx={{ fontSize: 28 }} />
        </Fab>
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Eliminar tarea"
        description={`¿Seguro que querés eliminar la tarea “${confirm.name}”? Esta acción no se puede deshacer.`}
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
