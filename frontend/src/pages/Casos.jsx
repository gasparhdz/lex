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

async function fetchCasosFn({ queryKey }) {
  const [_key, params] = queryKey;
  const { data } = await api.get("/casos", { params });
  return data; // { data: [], total, page, pageSize }
}

async function fetchEstadosCaso() {
  const { data } = await api.get("/parametros", { params: { categoria: "ESTADO_CASO", activo: true } });
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

const toInt = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const toOrder = (v) => (v === "desc" ? "desc" : "asc");
const toOrderBy = (v) => {
  if (!v) return "nroExpte";
  return ["nroExpte", "caratula", "cliente", "tipo", "estado"].includes(v) ? v : "nroExpte";
};

/* ---------- componente ---------- */
export default function Casos() {
  const nav = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Verificaciones de permisos
  const { canCrear, canEditar, canEliminar } = usePermisos('CASOS');
  
  // Estado inicial tomado de la URL
  const [page, setPage] = useState(toInt(searchParams.get("page"), 0));
  const [pageSize, setPageSize] = useState(toInt(searchParams.get("pageSize"), 10));
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const [orderBy, setOrderBy] = useState(toOrderBy(searchParams.get("orderBy")));
  const [order, setOrder] = useState(toOrder(searchParams.get("order")));
  
  // Filtro por estado
  const [estadoId, setEstadoId] = useState(searchParams.get("estadoId") ?? ""); // "" = todos
  const { data: estados = [] } = useQuery({ queryKey: ["estados-caso"], queryFn: fetchEstadosCaso, staleTime: 5 * 60 * 1000 });

  // Mantener URL en sync
  useEffect(() => {
    const next = new URLSearchParams();
    if (page) next.set("page", String(page));
    if (pageSize !== 10) next.set("pageSize", String(pageSize));
    if (debouncedSearch?.trim()) next.set("search", debouncedSearch.trim());
    if (orderBy !== "nroExpte") next.set("orderBy", orderBy);
    if (order !== "asc") next.set("order", order);
    if (estadoId) next.set("estadoId", estadoId);

    const changed = next.toString() !== searchParams.toString();
    if (changed) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, orderBy, order, estadoId]);

  // Si cambian externamente los searchParams, actualizamos el estado local
  useEffect(() => {
    setPage(toInt(searchParams.get("page"), 0));
    setPageSize(toInt(searchParams.get("pageSize"), 10));
    setSearch(searchParams.get("search") ?? "");
    setOrderBy(toOrderBy(searchParams.get("orderBy")));
    setOrder(toOrder(searchParams.get("order")));
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
      estadoId: estadoId ? Number(estadoId) : undefined, // número
    }),
    [page, pageSize, debouncedSearch, orderBy, order, estadoId]
  );

  const { data, isFetching, isError, error, refetch, isLoading } = useQuery({
    queryKey: ["casos", params],
    queryFn: fetchCasosFn,
    keepPreviousData: true,
    enabled: !!localStorage.getItem("token"),
  });

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;

  const handleSort = (prop) => {
    if (!["nroExpte", "caratula", "cliente", "tipo", "estado"].includes(prop)) return;
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
      const paramsFull = {
        ...params,
        pageSize: 10000,
        page: 1,
      };
      
      const { data } = await api.get("/casos", { params: paramsFull });
      const todos = data?.data ?? [];

      const datos = todos.map((c) => ({
        "Nro. Expediente": c.nroExpte,
        "Carátula": c.caratula,
        "Cliente": displayCliente(c.cliente),
        "Tipo": c.tipo?.nombre || "",
        "Estado": c.estado?.nombre || "",
      }));

      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Casos");

      const fecha = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `casos_${fecha}.xlsx`;

      XLSX.writeFile(wb, nombreArchivo);
      enqueueSnackbar("Excel exportado correctamente", { variant: "success" });
    } catch (e) {
      enqueueSnackbar("Error al exportar a Excel", { variant: "error" });
      console.error(e);
    }
  };

  // Acciones
  const verDetalle = (id) => nav(`/casos/${id}`, { state: { from: location } });
  const editar = (id) => nav(`/casos/editar/${id}`, { state: { from: location } });
  const pedirConfirmarEliminar = (c) => {
    setConfirm({ open: true, id: c.id, name: c.nroExpte });
  };
  const cerrarConfirm = () => setConfirm({ open: false, id: null, name: "" });

  const confirmarEliminar = async () => {
    try {
      setDeletingId(confirm.id);
      await api.delete(`/casos/${confirm.id}`);
      enqueueSnackbar("Caso eliminado", { variant: "success" });
      cerrarConfirm();
      refetch();
    } catch (e) {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "No se pudo eliminar el caso";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  /* ---------- Header (mobile y desktop) ---------- */

  // Desktop: buscador ocupa espacio disponible + Estado a la derecha
  const DesktopHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, minWidth: { xs: "100%", md: "auto" } }}>
          Casos
        </Typography>

        <TextField
          size="small"
          placeholder="Buscar por nro. expte, carátula o cliente…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: { xs: "100%", md: 320 } }}
        />

        <Box sx={{ 
          display: "flex", 
          gap: 2, 
          alignItems: "center", 
          flexWrap: "wrap", 
          ml: { xs: 0, md: "auto" }
        }}>
          <TextField
            select size="small" label="Estado" value={estadoId}
            onChange={(e) => { setEstadoId(e.target.value); setPage(0); }}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {estados.map((e) => (
              <MenuItem key={e.id} value={String(e.id)}>{e.nombre}</MenuItem>
            ))}
          </TextField>

          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportExcel}
            sx={{ textTransform: "none" }}
            disabled={isFetching}
          >
            Exportar
          </Button>

          {canCrear && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => nav("/casos/nuevo")}
              sx={{ textTransform: "none" }}
            >
              Nuevo
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );

  // Mobile: (1) Buscador, (2) Estado, (3) Ordenar + Flecha
  const MobileHeader = (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, mb: 1 }}>
        Casos
      </Typography>

      <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por nro. expte, carátula o cliente…"
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
          select size="small" label="Estado" value={estadoId}
          onChange={(e) => { setEstadoId(e.target.value); setPage(0); }}
        >
          <MenuItem value="">Todos</MenuItem>
          {estados.map((e) => (
            <MenuItem key={e.id} value={String(e.id)}>{e.nombre}</MenuItem>
          ))}
        </TextField>

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            select size="small" label="Ordenar por"
            value={orderBy} onChange={(e) => handleSort(e.target.value)}
            sx={{ flex: 1, minWidth: 160 }}
          >
            <MenuItem value="nroExpte">Nro. Expte</MenuItem>
            <MenuItem value="caratula">Carátula</MenuItem>
            <MenuItem value="cliente">Cliente</MenuItem>
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
    <Box sx={{ display: "grid", gap: 1.25 }}>
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
              sx={{ p: 1.25, borderRadius: 2, borderColor: "divider" }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>
                    {c.nroExpte}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, whiteSpace: "normal", wordBreak: "break-word" }}>
                    {c.caratula}
                  </Typography>
                  {/*<Typography variant="body2" sx={{ opacity: 0.7, whiteSpace: "normal", wordBreak: "break-word" }}>
                    Cliente: {displayCliente(c.cliente)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    Estado: {c.estado?.nombre || "-"}
                  </Typography>*/}
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
            No encontramos casos para mostrar.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.8 }}>
            Probá ajustar la búsqueda o creá un caso nuevo.
          </Typography>
          <Button variant="contained" size="small" onClick={() => nav("/casos/nuevo")}>
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
          tableLayout: "fixed",
          "& td, & th": {
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
          },
          "& td": { py: 0.75, lineHeight: 1.35 },
        }}
      >
        <TableHead>
          <TableRow
            sx={{
              "& th": {
                bgcolor: (t) => (t.palette.mode === "dark" ? "background.default" : "#fafafa"),
                fontWeight: 600,
                py: 1,
              },
            }}
          >
            <TableCell sx={{ width: 140 }} sortDirection={orderBy === "nroExpte" ? order : false}>
              <TableSortLabel
                active={orderBy === "nroExpte"}
                direction={orderBy === "nroExpte" ? order : "asc"}
                onClick={() => handleSort("nroExpte")}
              >
                Nro. Expte
              </TableSortLabel>
            </TableCell>

            {/* Carátula se lleva 40% del ancho */}
            <TableCell sx={{ width: "40%" }} sortDirection={orderBy === "caratula" ? order : false}>
              <TableSortLabel
                active={orderBy === "caratula"}
                direction={orderBy === "caratula" ? order : "asc"}
                onClick={() => handleSort("caratula")}
              >
                Carátula
              </TableSortLabel>
            </TableCell>

            {/* Cliente 24% (ajustá si querés) */}
            <TableCell sx={{ width: "24%" }} sortDirection={orderBy === "cliente" ? order : false}>
              <TableSortLabel
                active={orderBy === "cliente"}
                direction={orderBy === "cliente" ? order : "asc"}
                onClick={() => handleSort("cliente")}
              >
                Cliente
              </TableSortLabel>
            </TableCell>

            <TableCell sx={{ width: 140 }} sortDirection={orderBy === "tipo" ? order : false}>
              <TableSortLabel
                active={orderBy === "tipo"}
                direction={orderBy === "tipo" ? order : "asc"}
                onClick={() => handleSort("tipo")}
              >
                Tipo
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ width: 120 }} sortDirection={orderBy === "estado" ? order : false}>
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
                  <TableCell><Skeleton width="60%" /></TableCell>
                  <TableCell><Skeleton width="90%" /></TableCell>
                  <TableCell><Skeleton width="80%" /></TableCell>
                  <TableCell><Skeleton width="50%" /></TableCell>
                  <TableCell><Skeleton width="50%" /></TableCell>
                  <TableCell align="right"><Skeleton width="120px" /></TableCell>
                </TableRow>
              ))
            : rows.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {c.nroExpte}
                  </TableCell>

                  {/* Carátula: ellipsis + tooltip */}
                  <TableCell sx={{ overflow: "hidden" }}>
                    <Tooltip title={c.caratula || ""}>
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {c.caratula}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* Cliente: ellipsis + tooltip */}
                  <TableCell sx={{ overflow: "hidden" }}>
                    <Tooltip title={displayCliente(c.cliente)}>
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {displayCliente(c.cliente)}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* Tipo / Estado compactos con ellipsis */}
                  <TableCell sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Tooltip title={c.tipo?.nombre || "-"}>
                      <span>{c.tipo?.nombre || "-"}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <Tooltip title={c.estado?.nombre || "-"}>
                      <span>{c.estado?.nombre || "-"}</span>
                    </Tooltip>
                  </TableCell>

                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
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
              <TableCell colSpan={6}>
                <Box sx={{ py: 6, textAlign: "center", opacity: 0.8 }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    No encontramos casos para mostrar.
                  </Typography>
                  <Typography variant="body2">
                    Probá ajustar la búsqueda o creá un caso nuevo.
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
      {ProgressBar}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || "Ocurrió un error al cargar los casos."}
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
          onClick={() => nav("/casos/nuevo")}
          sx={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 1200,
            width: 64,
            height: 64,
            boxShadow: 5,
          }}
          aria-label="Nuevo caso"
        >
          <AddIcon sx={{ fontSize: 28 }} />
        </Fab>
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Eliminar caso"
        description={`¿Seguro que querés eliminar el caso “${confirm.name}”? Esta acción no se puede deshacer.`}
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
