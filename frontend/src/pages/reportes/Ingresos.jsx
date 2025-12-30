// src/pages/reportes/Ingresos.jsx
import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
  LinearProgress,
  TablePagination,
  Alert,
  Paper,
  TextField,
  Autocomplete,
} from "@mui/material";
import { ArrowBack, Download, ArrowUpward, ArrowDownward } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { esES } from "@mui/x-date-pickers/locales";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/axios";
import { listIngresos } from "../../api/finanzas/ingresos";
import { displayCliente, displayExpte } from "../../utils/finanzas";
import { formatCurrency } from "../../utils/format";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

export default function Ingresos() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState({ field: "fechaIngreso", order: "desc" });
  const [periodo, setPeriodo] = useState(dayjs());
  const [selectedCliente, setSelectedCliente] = useState(null);

  // Calcular períodos para comparación: mes actual y 2 anteriores
  const mesActual = useMemo(() => periodo.startOf('month'), [periodo]);
  const mesAnterior1 = useMemo(() => periodo.subtract(1, 'month').startOf('month'), [periodo]);
  const mesAnterior2 = useMemo(() => periodo.subtract(2, 'month').startOf('month'), [periodo]);

  // Query para obtener todos los ingresos de los últimos 12 meses (para el gráfico)
  const paramsGrafico = useMemo(() => {
    const hoy = dayjs();
    const fromGrafico = hoy.subtract(11, 'month').startOf('month').toDate();
    const toGrafico = hoy.endOf('month').toDate();
    
    const p = {
      page: 0,
      pageSize: 10000,
      from: fromGrafico.toISOString(),
      to: toGrafico.toISOString(),
    };
    
    if (selectedCliente) {
      p.clienteId = selectedCliente.id;
    }
    
    return p;
  }, [selectedCliente]);

  const { data: dataGrafico } = useQuery({
    queryKey: ["reportes", "ingresos-grafico", paramsGrafico],
    queryFn: () => listIngresos(paramsGrafico),
  });

  // Generar datos para el gráfico de últimos 12 meses
  const datosGrafico12Meses = useMemo(() => {
    if (!dataGrafico?.rows) return [];
    
    const hoy = dayjs();
    const mesesData = new Map();
    
    // Agrupar ingresos por mes
    dataGrafico.rows.forEach(ingreso => {
      const fecha = dayjs(ingreso.fechaIngreso);
      const key = fecha.format('YYYY-MM');
      const monto = Number(ingreso.montoPesosEquivalente) || 0;
      mesesData.set(key, (mesesData.get(key) || 0) + monto);
    });
    
    // Generar array de últimos 12 meses
    const meses = [];
    for (let i = 11; i >= 0; i--) {
      const mes = hoy.subtract(i, 'month').startOf('month');
      const key = mes.format('YYYY-MM');
      const total = mesesData.get(key) || 0;
      
      meses.push({
        mes: mes.format('MMM YY'),
        ingresos: Math.round(total * 100) / 100
      });
    }
    
    return meses;
  }, [dataGrafico]);

  const from = useMemo(() => periodo.startOf('month').toDate(), [periodo]);
  const to = useMemo(() => periodo.endOf('month').toDate(), [periodo]);

  const params = useMemo(() => {
    const p = {
      page,
      pageSize,
      orderBy: sortBy.field,
      order: sortBy.order,
      from: from.toISOString(),
      to: to.toISOString(),
    };
    
    if (selectedCliente) {
      p.clienteId = selectedCliente.id;
    }
    
    return p;
  }, [page, pageSize, from, to, selectedCliente, sortBy]);

  // Obtener clientes para el autocomplete
  const { data: clientesData } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => api.get("/clientes", { params: { pageSize: 1000 } }).then(r => r.data?.data || []),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["reportes", "ingresos", params],
    queryFn: () => listIngresos(params),
  });

  // Obtener datos de los meses anteriores para comparación
  const fromMesAnterior1 = useMemo(() => mesAnterior1.startOf('month').toDate().toISOString(), [mesAnterior1]);
  const toMesAnterior1 = useMemo(() => mesAnterior1.endOf('month').toDate().toISOString(), [mesAnterior1]);
  const fromMesAnterior2 = useMemo(() => mesAnterior2.startOf('month').toDate().toISOString(), [mesAnterior2]);
  const toMesAnterior2 = useMemo(() => mesAnterior2.endOf('month').toDate().toISOString(), [mesAnterior2]);

  const paramsMesAnterior1 = useMemo(() => {
    const p = {
      page: 0,
      pageSize: 10000,
      from: fromMesAnterior1,
      to: toMesAnterior1,
    };
    if (selectedCliente) p.clienteId = selectedCliente.id;
    return p;
  }, [fromMesAnterior1, toMesAnterior1, selectedCliente]);

  const paramsMesAnterior2 = useMemo(() => {
    const p = {
      page: 0,
      pageSize: 10000,
      from: fromMesAnterior2,
      to: toMesAnterior2,
    };
    if (selectedCliente) p.clienteId = selectedCliente.id;
    return p;
  }, [fromMesAnterior2, toMesAnterior2, selectedCliente]);

  const { data: dataMesAnterior1 } = useQuery({
    queryKey: ["reportes", "ingresos-mes", paramsMesAnterior1],
    queryFn: () => listIngresos(paramsMesAnterior1),
  });

  const { data: dataMesAnterior2 } = useQuery({
    queryKey: ["reportes", "ingresos-mes", paramsMesAnterior2],
    queryFn: () => listIngresos(paramsMesAnterior2),
  });

  // Calcular totales para las cards comparativas
  const totalsComparativos = useMemo(() => {
    const actual = Math.round((data?.rows?.reduce((acc, i) => {
      const monto = Number(i.montoPesosEquivalente) || 0;
      return acc + monto;
    }, 0) || 0) * 100) / 100;
    
    const anterior1 = Math.round((dataMesAnterior1?.rows?.reduce((acc, i) => {
      const monto = Number(i.montoPesosEquivalente) || 0;
      return acc + monto;
    }, 0) || 0) * 100) / 100;
    
    const anterior2 = Math.round((dataMesAnterior2?.rows?.reduce((acc, i) => {
      const monto = Number(i.montoPesosEquivalente) || 0;
      return acc + monto;
    }, 0) || 0) * 100) / 100;
    
    return { actual, anterior1, anterior2 };
  }, [data, dataMesAnterior1, dataMesAnterior2]);

  // Calcular variación porcentual
  const getVariacion = (actual, anterior) => {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return ((actual - anterior) / anterior * 100).toFixed(1);
  };

  // Formatear valores para el eje Y
  const formatAxisValue = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const handleExportExcel = async () => {
    try {
      const exportParams = {
        page: 0,
        pageSize: 10000,
        orderBy: sortBy.field,
        order: sortBy.order,
      };
      
      if (from && to) {
        exportParams.from = from.toISOString();
        exportParams.to = to.toISOString();
      }
      
      if (selectedCliente) {
        exportParams.clienteId = selectedCliente.id;
      }
      
      const allData = await listIngresos(exportParams);

      const wsData = [
        ["Fecha", "Cliente", "Caso", "Tipo", "Descripción", "Monto (ARS)"],
      ];
      
      allData.rows.forEach(i => {
        wsData.push([
          new Date(i.fechaIngreso).toLocaleDateString('es-AR'),
          displayCliente(i.cliente),
          displayExpte(i.caso),
          i.tipo?.nombre || "-",
          i.descripcion || "-",
          i.montoPesosEquivalente || 0,
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ingresos");
      const fileName = periodo ? `Ingresos_${periodo.format('YYYY-MM')}.xlsx` : `Ingresos_historico.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error al exportar Excel:", error);
    }
  };

  const handleSort = (field) => {
    if (sortBy.field === field) {
      setSortBy({ field, order: sortBy.order === "asc" ? "desc" : "asc" });
    } else {
      setSortBy({ field, order: "asc" });
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <IconButton onClick={() => navigate("/reportes")} sx={{ bgcolor: "action.hover" }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" fontWeight={600}>
            Ingresos
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Exportar a Excel">
            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={handleExportExcel}
              disabled={isLoading}
              sx={{ minWidth: 100 }}
            >
              Exportar
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {/* Filtros */}
      <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper", mb: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <Autocomplete
            options={clientesData || []}
            getOptionLabel={(option) => displayCliente(option)}
            value={selectedCliente}
            onChange={(_, newValue) => {
              setSelectedCliente(newValue);
              setPage(0);
            }}
            renderInput={(params) => (
              <TextField {...params} label="Filtrar por cliente" size="small" fullWidth />
            )}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            sx={{ minWidth: 200 }}
          />
          <LocalizationProvider
            dateAdapter={AdapterDayjs}
            adapterLocale="es"
            localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}
          >
            <Tooltip title="Selecciona el mes para el análisis">
              <div>
                <DatePicker
                  label="Período"
                  value={periodo}
                  onChange={(newValue) => {
                    setPeriodo(newValue);
                    setPage(0);
                  }}
                  views={['year', 'month']}
                  format="MMMM YYYY"
                  slotProps={{
                    textField: { 
                      size: "small", 
                      sx: { width: 200 }
                    },
                  }}
                />
              </div>
            </Tooltip>
          </LocalizationProvider>
        </Stack>
      </Paper>

      {isLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>Error: {error.message}</Alert>}

      {/* Cards Comparativas */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mb: 2 }}>
        {/* Mes Anterior 2 */}
        <Card sx={{ bgcolor: "grey.50" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {mesAnterior2.format('MMMM YYYY')}
            </Typography>
            <Typography variant="h5" fontWeight={700} color="text.primary">
              {formatCurrency(totalsComparativos.anterior2, "ARS")}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Typography variant="caption" color={totalsComparativos.actual >= totalsComparativos.anterior2 ? "success.main" : "error.main"}>
                {getVariacion(totalsComparativos.actual, totalsComparativos.anterior2)}%
              </Typography>
              {totalsComparativos.actual >= totalsComparativos.anterior2 ? (
                <ArrowUpward fontSize="small" sx={{ color: "success.main", fontSize: 14 }} />
              ) : (
                <ArrowDownward fontSize="small" sx={{ color: "error.main", fontSize: 14 }} />
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Mes Anterior 1 */}
        <Card sx={{ bgcolor: "info.50" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {mesAnterior1.format('MMMM YYYY')}
            </Typography>
            <Typography variant="h5" fontWeight={700} color="info.main">
              {formatCurrency(totalsComparativos.anterior1, "ARS")}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Typography variant="caption" color={totalsComparativos.actual >= totalsComparativos.anterior1 ? "success.main" : "error.main"}>
                {getVariacion(totalsComparativos.actual, totalsComparativos.anterior1)}%
              </Typography>
              {totalsComparativos.actual >= totalsComparativos.anterior1 ? (
                <ArrowUpward fontSize="small" sx={{ color: "success.main", fontSize: 14 }} />
              ) : (
                <ArrowDownward fontSize="small" sx={{ color: "error.main", fontSize: 14 }} />
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Mes Actual */}
        <Card sx={{ bgcolor: "success.50", border: "2px solid", borderColor: "success.main" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              {mesActual.format('MMMM YYYY')}
            </Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">
              {formatCurrency(totalsComparativos.actual, "ARS")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {data?.rows?.length || 0} ingresos
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Gráfico Comparativo */}
      <Paper variant="outlined" sx={{ borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`, mb: 2, p: 2 }}>
        <Typography variant="h6" fontWeight={600} mb={2}>
          Evolución de Ingresos (Últimos 12 Meses)
        </Typography>
        <Box sx={{ width: "100%", height: "300px" }}>
          <ResponsiveContainer>
            <LineChart
              data={datosGrafico12Meses}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis 
                tickFormatter={formatAxisValue}
              />
              <RechartsTooltip 
                formatter={(value) => formatCurrency(value, "ARS")}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="ingresos" 
                name="Ingresos"
                stroke="#2e7d32" 
                strokeWidth={3}
                dot={{ fill: "#2e7d32", r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Paper>

      {/* Tabla */}
      <Paper variant="outlined" sx={{ borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
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
                py: 0.5,
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
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }} onClick={() => handleSort("fechaIngreso")}>
                    Fecha
                    {sortBy.field === "fechaIngreso" && (sortBy.order === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                  </Box>
                </TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>Caso</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Descripción</TableCell>
                <TableCell align="right">Monto (ARS)</TableCell>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : !data?.rows?.length ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No hay ingresos para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((ingreso) => (
                  <TableRow key={ingreso.id} hover>
                    <TableCell>{new Date(ingreso.fechaIngreso).toLocaleDateString('es-AR')}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{displayCliente(ingreso.cliente)}</TableCell>
                    <TableCell>{displayExpte(ingreso.caso)}</TableCell>
                    <TableCell>{ingreso.tipo?.nombre || "-"}</TableCell>
                    <TableCell>{ingreso.descripcion || "-"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCurrency(ingreso.montoPesosEquivalente || 0, "ARS")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {data && data.total > 0 && (
        <TablePagination
          component="div"
          count={data.total}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            setPageSize(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
          labelRowsPerPage="Filas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count !== -1 ? count : `más de ${to}`}`}
          sx={{ mt: 2 }}
        />
      )}
    </Box>
  );
}
