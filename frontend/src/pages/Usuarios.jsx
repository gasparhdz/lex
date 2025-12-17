// src/pages/Usuarios.jsx
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { usePermiso } from "../auth/usePermissions";
import {
  Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Box, TextField, InputAdornment,
  Tooltip, Button, IconButton, Fab, Chip, Stack,
  useMediaQuery, LinearProgress, Skeleton, TableSortLabel
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { enqueueSnackbar } from "notistack";
import ConfirmDialog from "../components/ConfirmDialog";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import { fetchUsuarios } from "../api/usuarios";
import api from "../api/axios";

/* ---------- helpers ---------- */
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

async function fetchUsuariosFn({ queryKey }) {
  const [_key, params] = queryKey;
  const { data } = await api.get("/usuarios", { params });
  return data;
}

const displayName = (u) => {
  const n = (u.nombre || "").trim();
  const a = (u.apellido || "").trim();
  return `${a}, ${n}`.trim() || "Sin nombre";
};

/* ---------- componente ---------- */
export default function Usuarios() {
  const nav = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Permisos
  const canCrear = usePermiso("USUARIOS", "crear");
  const canEditar = usePermiso("USUARIOS", "editar");
  const canEliminar = usePermiso("USUARIOS", "eliminar");

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debouncedSearch = useDebounced(search, 300);
  const [orderBy, setOrderBy] = useState(searchParams.get("orderBy") || "nombre");
  const [order, setOrder] = useState(searchParams.get("order") || "asc");

  const [deletingId, setDeletingId] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, id: null, name: "" });

  // Mantener URL en sync
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch?.trim()) next.set("search", debouncedSearch.trim());
    if (orderBy !== "nombre") next.set("orderBy", orderBy);
    if (order !== "asc") next.set("order", order);
    const changed = next.toString() !== searchParams.toString();
    if (changed) setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, orderBy, order]);

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
    }),
    [debouncedSearch]
  );

  const { data: usuarios = [], isFetching, isError, isLoading, refetch } = useQuery({
    queryKey: ["usuarios", params],
    queryFn: fetchUsuariosFn,
    keepPreviousData: true,
    enabled: !!localStorage.getItem("token"),
  });

  const handleSort = (prop) => {
    if (!["nombre", "email", "dni", "activo"].includes(prop)) return;
    if (orderBy === prop) setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setOrderBy(prop);
      setOrder("asc");
    }
  };

  const usuariosFiltrados = useMemo(() => {
    if (!Array.isArray(usuarios)) return [];
    const sorted = [...usuarios];
    const dir = order === "asc" ? 1 : -1;
    
    sorted.sort((a, b) => {
      let aVal, bVal;
      switch (orderBy) {
        case "nombre":
          aVal = displayName(a).toLowerCase();
          bVal = displayName(b).toLowerCase();
          return aVal.localeCompare(bVal) * dir;
        case "email":
          aVal = (a.email || "").toLowerCase();
          bVal = (b.email || "").toLowerCase();
          return aVal.localeCompare(bVal) * dir;
        case "dni":
          aVal = (a.dni || "").toString();
          bVal = (b.dni || "").toString();
          return aVal.localeCompare(bVal) * dir;
        case "activo":
          aVal = a.activo ? 1 : 0;
          bVal = b.activo ? 1 : 0;
          return (aVal - bVal) * dir;
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [usuarios, orderBy, order]);

  const editar = (id) => nav(`/usuarios/editar/${id}`, { state: { from: location } });
  const pedirConfirmarEliminar = (u) => {
    setConfirm({ open: true, id: u.id, name: displayName(u) });
  };

  const cerrarConfirm = () => setConfirm({ open: false, id: null, name: "" });

  const confirmarEliminar = async () => {
    try {
      setDeletingId(confirm.id);
      await api.delete(`/usuarios/${confirm.id}`);
      enqueueSnackbar("Usuario eliminado", { variant: "success" });
      cerrarConfirm();
      refetch();
    } catch (e) {
      const msg =
        e?.response?.data?.publicMessage ||
        e?.response?.data?.message ||
        "No se pudo eliminar el usuario";
      enqueueSnackbar(msg, { variant: "error" });
    } finally {
      setDeletingId(null);
    }
  };

  /* ---------- UI comunes ---------- */
  const Header = (
    <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", mb: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, flexGrow: 1 }}>
        Usuarios
      </Typography>

      <TextField
        size="small"
        placeholder="Buscar por nombre, email, DNI…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: { xs: "100%", sm: 320 } }}
      />

        {!isMobile && canCrear && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => nav("/usuarios/nuevo", { state: { from: location } })}
          sx={{ textTransform: "none" }}
        >
          Nuevo
        </Button>
      )}
    </Box>
  );

  const ProgressBar = (isFetching || isLoading) ? (
    <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
  ) : null;

  /* ---------- Mobile layout (cards) ---------- */
  const MobileList = (
    <Box sx={{ display: "grid", gap: 1.25, px: 0.5, boxSizing: "border-box" }}>
      {isFetching && usuariosFiltrados.length === 0
        ? Array.from({ length: 6 }).map((_, i) => (
            <Paper key={`m-skel-${i}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Skeleton width="60%" />
              <Skeleton width="40%" />
              <Skeleton width="50%" />
            </Paper>
          ))
        : usuariosFiltrados.map((u) => (
            <Paper
              key={u.id}
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
                    {displayName(u)}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9, whiteSpace: "normal", wordBreak: "break-word" }}>
                    {u.email}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {u.roles?.map((ur) => (
                      <Chip key={ur.rol.id} label={ur.rol.nombre} size="small" />
                    ))}
                    <Chip
                      label={u.activo ? "Activo" : "Inactivo"}
                      color={u.activo ? "success" : "default"}
                      size="small"
                    />
                  </Stack>
                </Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {canEditar && (
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => editar(u.id)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEliminar && (
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => pedirConfirmarEliminar(u)}
                        disabled={deletingId === u.id}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Paper>
          ))}

      {!isFetching && usuariosFiltrados.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderRadius: 2 }}>
          <Typography variant="body1" sx={{ mb: 0.5 }}>
            No encontramos usuarios para mostrar.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.8 }}>
            Probá ajustar la búsqueda o creá un usuario nuevo.
          </Typography>
          <Button variant="contained" size="small" onClick={() => nav("/usuarios/nuevo", { state: { from: location } })}>
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
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }} sortDirection={orderBy === "nombre" ? order : false}>
              <TableSortLabel
                active={orderBy === "nombre"}
                direction={orderBy === "nombre" ? order : "asc"}
                onClick={() => handleSort("nombre")}
              >
                Nombre
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }} sortDirection={orderBy === "email" ? order : false}>
              <TableSortLabel
                active={orderBy === "email"}
                direction={orderBy === "email" ? order : "asc"}
                onClick={() => handleSort("email")}
              >
                Email
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }} sortDirection={orderBy === "dni" ? order : false}>
              <TableSortLabel
                active={orderBy === "dni"}
                direction={orderBy === "dni" ? order : "asc"}
                onClick={() => handleSort("dni")}
              >
                DNI
              </TableSortLabel>
            </TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Roles</TableCell>
            <TableCell sx={{ fontWeight: 700 }} sortDirection={orderBy === "activo" ? order : false}>
              <TableSortLabel
                active={orderBy === "activo"}
                direction={orderBy === "activo" ? order : "asc"}
                onClick={() => handleSort("activo")}
              >
                Estado
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {isFetching && usuariosFiltrados.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                </TableRow>
              ))
            : usuariosFiltrados.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <PersonIcon fontSize="small" color="action" />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {displayName(u)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {u.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.dni || "-"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {u.roles?.map((ur) => (
                        <Chip key={ur.rol.id} label={ur.rol.nombre} size="small" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={u.activo ? "Activo" : "Inactivo"}
                      color={u.activo ? "success" : "default"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                      {canEditar && (
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => editar(u.id)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEliminar && (
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => pedirConfirmarEliminar(u)}
                            disabled={deletingId === u.id}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}

          {!isFetching && usuariosFiltrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No hay usuarios para mostrar
                </Typography>
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
        <Typography variant="body2" color="error" sx={{ mt: 1, mb: 2 }}>
          Error al cargar usuarios
        </Typography>
      )}

      {isMobile ? MobileList : DesktopTable}

        {/* Botón flotante "Nuevo" en mobile */}
        {isMobile && canCrear && (
          <Fab
            color="primary"
            onClick={() => nav("/usuarios/nuevo", { state: { from: location } })}
            sx={{
              position: "fixed",
              right: 16,
              bottom: 16,
              zIndex: 1200,
              width: 64,
              height: 64,
              boxShadow: 5,
            }}
            aria-label="Nuevo usuario"
          >
            <AddIcon sx={{ fontSize: 28 }} />
          </Fab>
        )}

      <ConfirmDialog
        open={confirm.open}
        title="Eliminar usuario"
        description={`¿Seguro que querés eliminar a "${confirm.name}"? Esta acción no se puede deshacer.`}
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