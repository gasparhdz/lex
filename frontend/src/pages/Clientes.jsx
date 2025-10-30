// src/pages/Clientes.jsx
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { usePermisos } from "../auth/usePermissions";
import api from "../api/axios";
import {
  Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Box, TextField, InputAdornment,
  TableSortLabel, TablePagination, Alert, Skeleton, Tooltip, Button, IconButton, Fab,
  useMediaQuery, LinearProgress, MenuItem
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { enqueueSnackbar } from "notistack";
import ConfirmDialog from "../components/ConfirmDialog";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DownloadIcon from "@mui/icons-material/Download";
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

async function fetchClientesFn({ queryKey }) {
  const [_key, params] = queryKey;
  const { data } = await api.get("/clientes", { params });
  return data; // { data: [], total, page, pageSize }
}

const displayName = (c) => {
  if (c.razonSocial?.trim()) return c.razonSocial.trim();
  const a = (c.apellido || "").trim();
  const n = (c.nombre || "").trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || "Sin nombre";
};

const toInt = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const toOrder = (v) => (v === "desc" ? "desc" : "asc");
const toOrderBy = (v) => (v === "cuit" ? "cuit" : "displayName");

/* ---------- componente ---------- */
export default function Clientes() {
  const nav = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Verificaciones de permisos
  const { canCrear, canEditar, canEliminar } = usePermisos('CLIENTES');

  // Estado inicial tomado de la URL (querystring)
  const [page, setPage] = useState(toInt(searchParams.get("page"), 0));
  const [pageSize, setPageSize] = useState(toInt(searchParams.get("pageSize"), 10));
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [orderBy, setOrderBy] = useState(toOrderBy(searchParams.get("orderBy")));
  const [order, setOrder] = useState(toOrder(searchParams.get("order")));
  const [filtroTipo, setFiltroTipo] = useState(searchParams.get("tipo") ?? "");
  const [filtroEstado, setFiltroEstado] = useState(searchParams.get("activo") ?? "");

  const debouncedSearch = useDebounced(search, 300);

  // Mantener URL en sync (reemplaza en el historial para no generar "back" infinitos)
  useEffect(() => {
    const next = new URLSearchParams();
    if (page) next.set("page", String(page));
    if (pageSize !== 10) next.set("pageSize", String(pageSize));
    if (debouncedSearch?.trim()) next.set("search", debouncedSearch.trim());
    if (orderBy !== "displayName") next.set("orderBy", orderBy);
    if (order !== "asc") next.set("order", order);
    if (filtroTipo) next.set("tipo", filtroTipo);
    if (filtroEstado) next.set("activo", filtroEstado);

    // Sólo actualiza si cambió
    const changed = next.toString() !== searchParams.toString();
    if (changed) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, orderBy, order, filtroTipo, filtroEstado]);

  // Si cambian externamente los searchParams (e.g. navegación directa),
  // actualizamos el estado local.
  useEffect(() => {
    setPage(toInt(searchParams.get("page"), 0));
    setPageSize(toInt(searchParams.get("pageSize"), 10));
    setSearch(searchParams.get("search") ?? "");
    setOrderBy(toOrderBy(searchParams.get("orderBy")));
    setOrder(toOrder(searchParams.get("order")));
    setFiltroTipo(searchParams.get("tipo") ?? "");
    setFiltroEstado(searchParams.get("activo") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const [deletingId, setDeletingId] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" });

  const params = useMemo(
    () => ({
      page: page + 1,        // backend 1-based
      pageSize,
      search: debouncedSearch || undefined,
      orderBy,
      order,
      tipoPersonaId: filtroTipo ? Number(filtroTipo) : undefined,
      activo: filtroEstado ? (filtroEstado === "true") : undefined,
    }),
    [page, pageSize, debouncedSearch, orderBy, order, filtroTipo, filtroEstado]
  );

  const { data, isFetching, isError, error, refetch, isLoading } = useQuery({
    queryKey: ["clientes", params],
    queryFn: fetchClientesFn,
    keepPreviousData: true,
    enabled: !!localStorage.getItem("token"),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleSort = (prop) => {
    if (!["displayName", "cuit"].includes(prop)) return;
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

  // Exportar a Excel
  const handleExportExcel = async () => {
    try {
      // Obtener todos los datos aplicando los filtros actuales
      const paramsFull = {
        ...params,
        pageSize: 10000, // Obtener todos
        page: 1,
      };
      
      const { data } = await api.get("/clientes", { params: paramsFull });
      const todos = data?.data ?? [];

      // Preparar datos para Excel
      const datos = todos.map((c) => ({
        "Nombre/Apellido": displayName(c),
        "CUIT": c.cuit || "",
        "Email": c.email || "",
        "Teléfono": c.telCelular || "",
        "Estado": c.activo ? "Activo" : "Inactivo",
      }));

      // Crear workbook y worksheet
      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes");

      // Generar fecha para el nombre del archivo
      const fecha = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `clientes_${fecha}.xlsx`;

      // Descargar
      XLSX.writeFile(wb, nombreArchivo);
      enqueueSnackbar("Excel exportado correctamente", { variant: "success" });
    } catch (e) {
      enqueueSnackbar("Error al exportar a Excel", { variant: "error" });
      console.error(e);
    }
  };

  // Acciones (pasamos location en state para que el ABM pueda "volver" con precisión si quiere)
  const verDetalle = (id) => nav(`/clientes/${id}`, { state: { from: location } });
  const editar = (id) => nav(`/clientes/editar/${id}`, { state: { from: location } });
  const pedirConfirmarEliminar = (c) => {
    setConfirm({ open: true, id: c.id, name: displayName(c) });
  };

  const cerrarConfirm = () => setConfirm({ open: false, id: null, name: "" });

  const confirmarEliminar = async () => {
    try {
      setDeletingId(confirm.id);
      await api.delete(`/clientes/${confirm.id}`);
      enqueueSnackbar("Cliente eliminado", { variant: "success" });
      cerrarConfirm();
      refetch();
    } catch (e) {
      const msg =
        e?.response?.data?.publicMessage ||
        e?.response?.data?.message ||
        "No se pudo eliminar el cliente";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  /* ---------- Cargar tipos de persona ---------- */
  const { data: tiposPersona = [] } = useQuery({
    queryKey: ["tiposPersona"],
    queryFn: () => api.get("/parametros?categoria=TIPO_PERSONA&activo=true&pageSize=1000").then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  });

  /* ---------- UI comunes ---------- */
  const Header = (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, minWidth: { xs: "100%", md: "auto" } }}>
          Clientes
        </Typography>

        <TextField
          size="small"
          placeholder="Buscar por nombre/razón social, CUIT, email, teléfono…"
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
          ml: { xs: 0, md: "auto" },
          width: { xs: "100%", md: "auto" }
        }}>
          <TextField
            size="small"
            select
            label="Tipo"
            value={filtroTipo}
            onChange={(e) => { setFiltroTipo(e.target.value); setPage(0); }}
            sx={{ flex: { xs: "1 1 100%", sm: "0 0 auto" }, minWidth: { xs: "100%", sm: 150 } }}
          >
            <MenuItem value="">Todos</MenuItem>
            {tiposPersona.map((tipo) => (
              <MenuItem key={tipo.id} value={String(tipo.id)}>
                {tipo.nombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            select
            label="Estado"
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPage(0); }}
            sx={{ flex: { xs: "1 1 100%", sm: "0 0 auto" }, minWidth: { xs: "100%", sm: 130 } }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="true">Activos</MenuItem>
            <MenuItem value="false">Inactivos</MenuItem>
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
          
          {!isMobile && canCrear && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => nav("/clientes/nuevo", { state: { from: location } })}
              sx={{ textTransform: "none" }}
            >
              Nuevo
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );

  const ProgressBar = (isFetching || isLoading) ? (
    <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
  ) : null;

  /* ---------- Mobile layout (cards) ---------- */
  const MobileControls = (
    <Box sx={{ display: "grid", gap: 1, mb: 1 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", minWidth: 0 }}>
        <TextField
          select
          size="small"
          label="Ordenar por"
          value={orderBy}
          onChange={(e) => handleSort(e.target.value)}
          sx={{ flex: 1, minWidth: 0 }}
       >
          <MenuItem value="displayName">Nombre / Razón social</MenuItem>
          <MenuItem value="cuit">CUIT</MenuItem>
        </TextField>
        <IconButton
          size="small"
          onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))}
          aria-label="Cambiar orden"
          sx={{ border: 1, borderColor: "divider", flexShrink: 0 }}
        >
          {order === "asc" ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  );

  const MobileList = (
    <Box sx={{ display: "grid", gap: 1.25, px: 0.5, boxSizing: "border-box" }}>
      {isFetching && rows.length === 0
        ? Array.from({ length: 6 }).map((_, i) => (
            <Paper key={`m-skel-${i}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Skeleton width="50%" />
            </Paper>
          ))
        : rows.map((c) => (
            <Paper
              key={c.id}
              variant="outlined"
              sx={{
                p: 1.25,
                borderRadius: 2,
                borderColor: "divider",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, whiteSpace: "normal", wordBreak: "break-word" }}>
                    {displayName(c)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, whiteSpace: "normal", wordBreak: "break-word" }}>
                    CUIT: {c.cuit || "-"}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.7, whiteSpace: "normal", wordBreak: "break-word" }}>
                    {c.email || "-"} • {c.telCelular || "-"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <Tooltip title="Detalle">
                    <IconButton size="small" onClick={() => verDetalle(c.id)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canEditar && (
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => editar(c.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEliminar && (
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => pedirConfirmarEliminar(c)}
                        disabled={deletingId === c.id}
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
            No encontramos clientes para mostrar.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.8 }}>
            Probá ajustar la búsqueda o creá un cliente nuevo.
          </Typography>
          <Button variant="contained" size="small" onClick={() => nav("/clientes/nuevo", { state: { from: location } })}>
            Nuevo
          </Button>
        </Paper>
      )}
    </Box>
  );

  /* ---------- Desktop layout (table) ---------- */
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
          "& td, & th": (t) => ({
            borderBottom: `1px solid ${t.palette.divider}`,
          }),
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
            <TableCell sortDirection={orderBy === "displayName" ? order : false}>
              <TableSortLabel
                active={orderBy === "displayName"}
                direction={orderBy === "displayName" ? order : "asc"}
                onClick={() => handleSort("displayName")}
              >
                Apellido y Nombre / Razón social
              </TableSortLabel>
            </TableCell>

            <TableCell sortDirection={orderBy === "cuit" ? order : false} sx={{ width: 160 }}>
              <TableSortLabel
                active={orderBy === "cuit"}
                direction={orderBy === "cuit" ? order : "asc"}
                onClick={() => handleSort("cuit")}
              >
                CUIT
              </TableSortLabel>
            </TableCell>

            {/* Email y Tel. SIN orden */}
            <TableCell sx={{ width: 260 }}>Email</TableCell>
            <TableCell sx={{ width: 170 }}>Tel. Celular</TableCell>

            <TableCell align="right" sx={{ width: 180 }}>
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
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell><Skeleton width="40%" /></TableCell>
                  <TableCell><Skeleton width="70%" /></TableCell>
                  <TableCell><Skeleton width="50%" /></TableCell>
                  <TableCell align="right"><Skeleton width={140} /></TableCell>
                </TableRow>
              ))
            : rows.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{displayName(c)}</TableCell>
                  <TableCell>{c.cuit || "-"}</TableCell>
                  <TableCell>{c.email || "-"}</TableCell>
                  <TableCell>{c.telCelular || "-"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Detalle">
                      <IconButton size="small" onClick={() => verDetalle(c.id)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canEditar && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => editar(c.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEliminar && (
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => pedirConfirmarEliminar(c)}
                          disabled={deletingId === c.id}
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
              <TableCell colSpan={5}>
                <Box sx={{ py: 6, textAlign: "center", opacity: 0.8 }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    No encontramos clientes para mostrar.
                  </Typography>
                  <Typography variant="body2">
                    Probá ajustar la búsqueda o creá un cliente nuevo.
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
        p: 2,
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => (t.palette.mode === "dark" ? "background.paper" : "#fff"),
      }}
    >
      {Header}
      {isMobile && MobileControls}
      {ProgressBar}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || "Ocurrió un error al cargar los clientes."}
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

      {/* Botón flotante “Nuevo” en mobile */}
      {isMobile && canCrear && (
        <Fab
          color="primary"
          onClick={() => nav("/clientes/nuevo", { state: { from: location } })}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 1200,
            width: 64,
            height: 64,
            boxShadow: 5,
          }}
          aria-label="Nuevo cliente"
        >
          <AddIcon sx={{ fontSize: 28 }} />
        </Fab>
      )}
      <ConfirmDialog
        open={confirm.open}
        title="Eliminar cliente"
        description={`¿Seguro que querés eliminar a “${confirm.name}”? Esta acción no se puede deshacer.`}
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
