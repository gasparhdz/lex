// src/components/configuracion/RolesPermisosTab.jsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Button, IconButton, Tooltip, Alert, Skeleton,
  Chip, LinearProgress, TablePagination
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ConfirmDialog from '../ConfirmDialog';
import { usePermiso } from '../../auth/usePermissions';
import { enqueueSnackbar } from 'notistack';
import api from '../../api/axios';

export default function RolesPermisosTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [abrirConfirm, setAbrirConfirm] = useState({ open: false, id: null, nombre: '' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const { data: rolesResp = [], isFetching: loading, refetch } = useQuery({
    queryKey: ['roles', page, pageSize],
    queryFn: () => api.get('/usuarios/roles', { 
      params: { page: page + 1, pageSize }
    }).then(r => r.data),
    keepPreviousData: true,
  });
  
  // El backend devuelve un array directamente o { data, total }
  const roles = Array.isArray(rolesResp) ? rolesResp : (rolesResp.data || []);
  const totalRoles = Array.isArray(rolesResp) ? rolesResp.length : (rolesResp.total || 0);

  const puedeVer = usePermiso('CONFIGURACION', 'ver');
  const puedeCrear = usePermiso('CONFIGURACION', 'crear');
  const puedeEditar = usePermiso('CONFIGURACION', 'editar');
  const puedeEliminar = usePermiso('CONFIGURACION', 'eliminar');

  const handleCrear = () => {
    navigate('/configuracion/roles/nuevo');
  };

  const handleEditar = (rol) => {
    navigate(`/configuracion/roles/editar/${rol.id}`);
  };

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      enqueueSnackbar('Rol eliminado correctamente', { variant: 'success' });
      setAbrirConfirm({ open: false, id: null, nombre: '' });
    },
    onError: (err) => {
      const msg = err?.response?.data?.publicMessage || 'Error al eliminar rol';
      enqueueSnackbar(msg, { variant: 'error' });
    },
  });

  const handleConfirmarEliminar = () => {
    deleteMut.mutate(abrirConfirm.id);
  };

  if (!puedeVer) {
    return <Alert severity="warning">No tiene permisos para ver esta sección</Alert>;
  }

  // Header
  const Header = (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, flexGrow: 1 }}>
        Roles y Permisos
      </Typography>

      {puedeCrear && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCrear}
          sx={{ textTransform: 'none' }}
        >
          Nuevo Rol
        </Button>
      )}
    </Box>
  );

  const ProgressBar = loading && !roles.length ? (
    <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
  ) : null;

  // Desktop Table
  const DesktopTable = (
    <Box
      sx={{
        overflowX: 'auto',
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
            <TableCell><strong>Código</strong></TableCell>
            <TableCell><strong>Nombre</strong></TableCell>
            <TableCell><strong>Usuarios</strong></TableCell>
            <TableCell><strong>Permisos</strong></TableCell>
            <TableCell><strong>Estado</strong></TableCell>
            <TableCell align="right"><strong>Acciones</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
                <TableCell><Skeleton /></TableCell>
              </TableRow>
            ))
          ) : roles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                <Typography variant="body1" color="text.secondary">
                  No hay roles creados
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            roles.map((rol) => (
              <TableRow key={rol.id} hover>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">{rol.codigo}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{rol.nombre}</Typography>
                </TableCell>
                <TableCell>{rol._count?.usuarios || 0}</TableCell>
                <TableCell>{rol._count?.permisos || 0}</TableCell>
                <TableCell>
                  <Chip
                    label={rol.activo ? 'Activo' : 'Inactivo'}
                    color={rol.activo ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                    {puedeEditar && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleEditar(rol)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {puedeEliminar && (
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setAbrirConfirm({ open: true, id: rol.id, nombre: rol.nombre })}
                          disabled={rol._count?.usuarios > 0}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  );

  return (
    <Box>
      {Header}
      {ProgressBar}
      {DesktopTable}
      
      <TablePagination
        component="div"
        count={totalRoles}
        page={page}
        onPageChange={(_e, newPage) => setPage(newPage)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setPageSize(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Filas por página"
        sx={{ mt: 1 }}
      />

      <ConfirmDialog
        open={abrirConfirm.open}
        onClose={() => setAbrirConfirm({ open: false, id: null, nombre: '' })}
        onConfirm={handleConfirmarEliminar}
        title="Confirmar eliminación"
        message={`¿Está seguro que desea eliminar el rol "${abrirConfirm.nombre}"?`}
        loading={deleteMut.isPending}
      />
    </Box>
  );
}
