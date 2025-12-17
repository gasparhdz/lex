// src/components/configuracion/ParametrosTab.jsx
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { usePermisos } from '../../auth/usePermissions';
import {
  Box, Table, TableHead, TableRow, TableCell, TableBody,
  Typography, Button, Chip, IconButton, Tooltip, Alert, Skeleton,
  MenuItem, TextField, LinearProgress, TablePagination
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import api from '../../api/axios';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ConfirmDialog from '../ConfirmDialog';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../utils/format';

export default function ParametrosTab() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [parentIdFiltro, setParentIdFiltro] = useState('');
  const [abrirConfirm, setAbrirConfirm] = useState({ open: false, id: null, nombre: '' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const { canCrear, canEditar, canEliminar } = usePermisos('CONFIGURACION');

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.get('/parametros/categorias').then(r => r.data),
  });

  const categoria = useMemo(() => {
    return categorias.find(c => String(c.id) === String(categoriaSeleccionada));
  }, [categorias, categoriaSeleccionada]);

  // Determinar si la categoría requiere filtro de parent
  const requiereParent = categoria?.codigo === 'TIPO_CASO' || categoria?.codigo === 'RADICACION';
  
  // Determinar qué categoría de padres usar
  const categoriaPadreCodigo = categoria?.codigo === 'TIPO_CASO' ? 'RAMA_DERECHO' : 
                                categoria?.codigo === 'RADICACION' ? 'LOCALIDAD_RADICACION' : null;
  
  // Cargar parámetros padres si la categoría lo requiere
  const { data: parametrosPadres = [] } = useQuery({
    queryKey: ['parametros-padres', categoriaPadreCodigo],
    queryFn: () => api.get('/parametros', { 
      params: { categoria: categoriaPadreCodigo, activo: true } 
    }).then(r => r.data),
    enabled: !!categoriaPadreCodigo,
  });

  // Resetear filtro de parent cuando cambia la categoría
  useEffect(() => {
    setParentIdFiltro('');
    setPage(0);
  }, [categoriaSeleccionada]);

  const { data: parametrosResp = [], isFetching: loadingParams, refetch } = useQuery({
    queryKey: ['parametros', categoriaSeleccionada, parentIdFiltro, page, pageSize],
    queryFn: () => {
      // Todas las categorías (virtuales o no) usan el mismo endpoint
      const params = { 
        categoriaId: categoriaSeleccionada, 
        activo: false,
        page: page + 1,
        pageSize
      };
      
      // Agregar filtro de parent si está seleccionado
      if (parentIdFiltro && parentIdFiltro !== '') {
        params.parentId = parentIdFiltro;
      }
      
      return api.get('/parametros', { params }).then(r => r.data);
    },
    enabled: !!categoriaSeleccionada,
    keepPreviousData: true,
  });
  
  // El backend devuelve un array directamente o { data, total }
  const parametrosRaw = Array.isArray(parametrosResp) ? parametrosResp : (parametrosResp.data || []);
  const totalParametros = Array.isArray(parametrosResp) ? parametrosResp.length : (parametrosResp.total || 0);

  // Transformar datos si es categoría virtual
  const parametros = useMemo(() => {
    if (!categoria?.virtual) return parametrosRaw;
    
    // Las categorías virtuales ya vienen transformadas desde el backend
    // Si es categoría Valor JUS, formatear el nombre como moneda
    if (categoriaSeleccionada.includes('VALOR_JUS')) {
      return parametrosRaw.map(p => ({
        ...p,
        nombreFormateado: isNaN(Number(p.nombre)) ? p.nombre : formatCurrency(Number(p.nombre), 'ARS')
      }));
    }
    return parametrosRaw;
  }, [parametrosRaw, categoria, categoriaSeleccionada]);

  // Cargar categoría desde URL al montar
  useEffect(() => {
    const catIdFromUrl = searchParams.get('categoriaId');
    if (catIdFromUrl && !categoriaSeleccionada) {
      setCategoriaSeleccionada(catIdFromUrl);
    }
  }, [searchParams, categoriaSeleccionada]);

  const handleCrear = () => {
    if (categoria?.virtual) {
      // Para categorías virtuales, navegar según el tipo
      // Extraer el tipo después de VIRTUAL_
      const routeType = categoriaSeleccionada.replace('VIRTUAL_', '').toLowerCase();
      
      navigate(`/configuracion/${routeType}/nuevo?categoriaId=${categoriaSeleccionada}`);
    } else {
      navigate(`/configuracion/parametros/nuevo?categoriaId=${categoriaSeleccionada}`);
    }
  };

  const handleEditar = (param) => {
    if (categoria?.virtual) {
      // Extraer el tipo después de VIRTUAL_
      const routeType = categoriaSeleccionada.replace('VIRTUAL_', '').toLowerCase();
      
      navigate(`/configuracion/${routeType}/editar/${param.id}?categoriaId=${categoriaSeleccionada}`);
    } else {
      navigate(`/configuracion/parametros/editar/${param.id}?categoriaId=${categoriaSeleccionada}`);
    }
  };

  const handleConfirmarEliminar = async () => {
    try {
      if (categoria?.virtual) {
        const tipo = categoriaSeleccionada.replace('VIRTUAL_', '').toLowerCase();
        // Mapear el tipo al endpoint correcto
        const endpoint = tipo === 'codigo_postal' ? 'codigospostales' : `${tipo}s`;
        await api.delete(`/${endpoint}/${abrirConfirm.id}`);
      } else {
        await api.delete(`/parametros/${abrirConfirm.id}`);
      }
      enqueueSnackbar('Eliminado correctamente', { variant: 'success' });
      setAbrirConfirm({ open: false, id: null, nombre: '' });
      refetch();
    } catch (err) {
      const msg = err?.response?.data?.publicMessage || 'Error al eliminar';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  // Header
  const Header = (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2, flexGrow: 1 }}>
        Parámetros
      </Typography>

      <TextField
        select
        label="Categoría"
        value={categoriaSeleccionada}
        onChange={(e) => setCategoriaSeleccionada(e.target.value)}
        size="small"
        sx={{ minWidth: 250 }}
      >
        <MenuItem value="">
          <em>Seleccione una categoría</em>
        </MenuItem>
        {categorias.map((cat) => (
          <MenuItem key={cat.id} value={String(cat.id)}>
            {cat.nombre}
          </MenuItem>
        ))}
      </TextField>

      {requiereParent && (
        <TextField
          select
          label={categoriaPadreCodigo === 'RAMA_DERECHO' ? 'Rama de Derecho' : 'Localidad'}
          value={parentIdFiltro}
          onChange={(e) => {
            setParentIdFiltro(e.target.value);
            setPage(0);
          }}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">
            <em>Todos</em>
          </MenuItem>
          {parametrosPadres.map((p) => (
            <MenuItem key={p.id} value={String(p.id)}>
              {p.nombre}
            </MenuItem>
          ))}
        </TextField>
      )}

      {categoria && canCrear && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCrear}
          sx={{ textTransform: 'none' }}
        >
          Nuevo Parámetro
        </Button>
      )}
    </Box>
  );

  const ProgressBar = loadingParams && !parametros.length ? (
    <LinearProgress sx={{ mb: 1, borderRadius: 1 }} />
  ) : null;

  // Desktop Table
  const DesktopTable = (
    <Box
      sx={{
        overflow: 'auto',
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Nombre</TableCell>
            {categoriaSeleccionada.includes('VALOR_JUS') && (
              <TableCell sx={{ fontWeight: 700 }}>Vigente Desde</TableCell>
            )}
            <TableCell sx={{ fontWeight: 700 }}>Orden</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Estado</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loadingParams && parametros.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  {categoriaSeleccionada.includes('VALOR_JUS') && <TableCell><Skeleton /></TableCell>}
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                  <TableCell><Skeleton /></TableCell>
                </TableRow>
              ))
            : parametros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={categoriaSeleccionada.includes('VALOR_JUS') ? 6 : 5} align="center" sx={{ py: 6 }}>
                    <Typography variant="body1" color="text.secondary">
                      No hay parámetros en esta categoría
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                parametros.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">{p.codigo}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{p.nombreFormateado || p.nombre}</Typography>
                    </TableCell>
                    {categoriaSeleccionada.includes('VALOR_JUS') && (
                      <TableCell>
                        <Typography variant="body2">
                          {p.extra?.fecha ? new Date(p.extra.fecha).toLocaleDateString('es-AR') : '-'}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>{p.orden || 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={p.activo ? 'Activo' : 'Inactivo'}
                        color={p.activo ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        {canEditar && (
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => handleEditar(p)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canEliminar && (
                          <Tooltip title="Eliminar">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setAbrirConfirm({ open: true, id: p.id, nombre: p.nombre })}
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
      {categoria ? (
        <>
          {DesktopTable}
          
          <TablePagination
            component="div"
            count={totalParametros}
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
        </>
      ) : (
        <Alert severity="info">Seleccione una categoría para ver sus parámetros</Alert>
      )}

      <ConfirmDialog
        open={abrirConfirm.open}
        title="Eliminar parámetro"
        description={`¿Desea eliminar el parámetro "${abrirConfirm.nombre}"?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmColor="error"
        onClose={() => setAbrirConfirm({ open: false, id: null, nombre: '' })}
        onConfirm={handleConfirmarEliminar}
      />
    </Box>
  );
}
