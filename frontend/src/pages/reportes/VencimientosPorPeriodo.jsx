// src/pages/reportes/VencimientosPorPeriodo.jsx
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
  Chip,
  TextField,
  Autocomplete,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { ArrowBack, Download, ArrowUpward, ArrowDownward } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { esES } from "@mui/x-date-pickers/locales";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/axios";
import { displayCliente, displayExpte } from "../../utils/finanzas";
import { formatCurrency } from "../../utils/format";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";

export default function VencimientosPorPeriodo() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState({ field: "vencimiento", order: "asc" });
  const [periodo, setPeriodo] = useState(dayjs());
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [soloPendientes, setSoloPendientes] = useState(false);

  const params = useMemo(() => {
    const p = {
      page: page + 1,
      pageSize,
      mes: periodo.month() + 1,
      anio: periodo.year(),
    };
    if (selectedCliente) {
      p.clienteId = selectedCliente.id;
    }
    return p;
  }, [page, pageSize, periodo, selectedCliente]);

  // Obtener clientes para el autocomplete
  const { data: clientesData } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => api.get("/clientes", { params: { pageSize: 1000 } }).then(r => r.data?.data || []),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["reportes", "vencimientos-periodo", params],
    queryFn: () => api.get("/finanzas/reportes/vencimientos-periodo", { params }).then(r => r.data),
  });

  // Procesar y ordenar datos
  const processedData = useMemo(() => {
    if (!data?.data) return data?.data || [];
    
    // Filtrar por cliente si hay uno seleccionado
    let filtered = data.data;
    if (selectedCliente) {
      filtered = data.data.filter(c => c.plan?.honorario?.clienteId === selectedCliente.id);
    }
    
    // Filtrar solo pendientes si está activado
    if (soloPendientes) {
      filtered = filtered.filter(c => 
        c.estado?.codigo !== "PAGADA" && c.calc?.saldo > 0
      );
    }
    
    // Ordenar
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy.field === "vencimiento") {
        const dateA = new Date(a.vencimiento);
        const dateB = new Date(b.vencimiento);
        return sortBy.order === "asc" ? dateA - dateB : dateB - dateA;
      } else if (sortBy.field === "saldo") {
        return sortBy.order === "asc" ? a.calc?.saldo - b.calc?.saldo : b.calc?.saldo - a.calc?.saldo;
      }
      return 0;
    });

    return sorted;
  }, [data, sortBy, selectedCliente, soloPendientes]);

  const handleExportExcel = async () => {
    try {
      const exportParams = {
        page: 1,
        pageSize: 10000,
        mes: periodo.month() + 1,
        anio: periodo.year(),
      };
      if (selectedCliente) {
        exportParams.clienteId = selectedCliente.id;
      }
      
      const allData = await api.get("/finanzas/reportes/vencimientos-periodo", {
        params: exportParams,
      }).then(r => r.data?.data || []);
      
      // Aplicar filtros en el cliente side para Excel
      let filteredData = allData;
      if (selectedCliente) {
        filteredData = allData.filter(c => c.plan?.honorario?.clienteId === selectedCliente.id);
      }
      if (soloPendientes) {
        filteredData = filteredData.filter(c => 
          c.estado?.codigo !== "PAGADA" && c.calc?.saldo > 0
        );
      }

      const wsData = [
        ["Cliente", "Caso", "Vencimiento", "Monto", "Pagado", "Saldo", "% Pagado", "Estado"],
      ];
      
      filteredData.forEach(c => {
        wsData.push([
          displayCliente(c.plan?.honorario?.cliente),
          displayExpte(c.plan?.honorario?.caso),
          new Date(c.vencimiento).toLocaleDateString('es-AR'),
          c.calc?.montoTotal || 0,
          c.calc?.pagado || 0,
          c.calc?.saldo || 0,
          `${c.calc?.percPagado || 0}%`,
          c.estado?.nombre || (c.calc?.percPagado >= 100 ? "Pagada" : "Pendiente"),
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vencimientos");
      XLSX.writeFile(wb, `Vencimientos_${periodo.format('YYYY-MM')}.xlsx`);
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

  // Datos para el gráfico
  const chartData = useMemo(() => {
    if (!data?.data) return [];
    
    const totals = data.data.reduce((acc, c) => ({
      pagado: acc.pagado + (c.calc?.pagado || 0),
      saldo: acc.saldo + (c.calc?.saldo || 0),
    }), { pagado: 0, saldo: 0 });

    return [
      { name: "Pagado", value: totals.pagado, color: "#2e7d32" },
      { name: "Pendiente", value: totals.saldo, color: "#d32f2f" },
    ];
  }, [data]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2} mb={3}>
          <IconButton onClick={() => navigate("/reportes")} sx={{ bgcolor: "action.hover" }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" fontWeight={600}>
            Vencimientos del Mes
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
              setPage(0); // Resetear página al cambiar filtro
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
            <Tooltip title="Selecciona el mes para ver los vencimientos">
              <div>
                <DatePicker
                  label="Período"
                  value={periodo}
                  onChange={(newValue) => {
                    setPeriodo(newValue);
                    setPage(0); // Resetear página al cambiar período
                  }}
                  views={['year', 'month']}
                  format="MMMM YYYY"
                  slotProps={{
                    textField: { size: "small", sx: { width: 200 } },
                  }}
                />
              </div>
            </Tooltip>
          </LocalizationProvider>
        </Stack>
      </Paper>

      {isLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>Error: {error.message}</Alert>}

      {/* Cards de Resumen */}
      {chartData.length > 0 && (() => {
        const total = chartData.reduce((acc, d) => acc + d.value, 0);
        const pagado = chartData[0]?.value || 0;
        const pendiente = chartData[1]?.value || 0;
        const percPagado = total > 0 ? ((pagado / total) * 100).toFixed(1) : 0;
        const percPendiente = total > 0 ? ((pendiente / total) * 100).toFixed(1) : 0;
        
        return (
          <>
            {/* Cards de Métricas */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mb: 2 }}>
              <Card sx={{ bgcolor: "info.50" }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Total Cuotas
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="primary">
                    {formatCurrency(total, "ARS")}
                  </Typography>
                </CardContent>
              </Card>
              
              <Card sx={{ bgcolor: "success.50", border: "2px solid", borderColor: "success.main" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="caption" color="success.dark" display="block" fontWeight={600}>
                      Pagado
                    </Typography>
                    <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#2e7d32" }} />
                  </Box>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {formatCurrency(pagado, "ARS")}
                  </Typography>
                  <Typography variant="caption" color="success.dark">
                    {percPagado}% del total
                  </Typography>
                </CardContent>
              </Card>
              
              <Card sx={{ bgcolor: "error.50", border: "2px solid", borderColor: "error.main" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="caption" color="error.dark" display="block" fontWeight={600}>
                      Saldo Pendiente
                    </Typography>
                    <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#d32f2f" }} />
                  </Box>
                  <Typography variant="h5" fontWeight={700} color="error.main">
                    {formatCurrency(pendiente, "ARS")}
                  </Typography>
                  <Typography variant="caption" color="error.dark">
                    {percPendiente}% del total
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Gráfico Compacto */}
            <Paper variant="outlined" sx={{ borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`, mb: 2, p: 2 }}>
              <Typography variant="h6" fontWeight={600} mb={1}>
                Distribución Visual
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Box sx={{ width: "200px", height: "200px", position: "relative", flexShrink: 0 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value) => formatCurrency(value, "ARS")}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ 
                    position: "absolute", 
                    top: "50%", 
                    left: "50%", 
                    transform: "translate(-50%, -50%)",
                    textAlign: "center"
                  }}>
                    <Typography variant="h4" fontWeight={700} color="text.primary">
                      {percPagado}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Pagado
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" color="text.secondary">Progreso de Pagos</Typography>
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption" color="success.main">Pagado ({percPagado}%)</Typography>
                        <Typography variant="caption" fontWeight={600}>{formatCurrency(pagado, "ARS")}</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Number(percPagado)} 
                        sx={{ height: 8, borderRadius: 1, bgcolor: "error.100" }}
                      />
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption" color="error.main">Pendiente ({percPendiente}%)</Typography>
                        <Typography variant="caption" fontWeight={600}>{formatCurrency(pendiente, "ARS")}</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Number(percPendiente)} 
                        color="error"
                        sx={{ height: 8, borderRadius: 1 }}
                      />
                    </Box>
                  </Stack>
                </Box>
              </Box>
            </Paper>
          </>
        );
      })()}

      {/* Filtro de solo pendientes */}
      <Paper variant="outlined" sx={{ borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}`, mb: 2, p: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={soloPendientes}
              onChange={(e) => {
                setSoloPendientes(e.target.checked);
                setPage(0); // Resetear página al cambiar filtro
              }}
            />
          }
          label="Mostrar solo cuotas con saldo pendiente"
        />
      </Paper>

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
                <TableCell>Cliente</TableCell>
                <TableCell>Caso</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }} onClick={() => handleSort("vencimiento")}>
                    Vencimiento
                    {sortBy.field === "vencimiento" && (sortBy.order === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                  </Box>
                </TableCell>
                <TableCell align="right">Monto</TableCell>
                <TableCell align="right">Pagado</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5, cursor: "pointer" }} onClick={() => handleSort("saldo")}>
                    Saldo
                    {sortBy.field === "saldo" && (sortBy.order === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                  </Box>
                </TableCell>
                <TableCell align="center">% Pagado</TableCell>
                <TableCell align="center">Estado</TableCell>
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
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : !processedData?.length ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    No hay cuotas vencidas este mes
                  </TableCell>
                </TableRow>
              ) : (
                processedData.map((cuota) => (
                  <TableRow key={cuota.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{displayCliente(cuota.plan?.honorario?.cliente)}</TableCell>
                    <TableCell>{displayExpte(cuota.plan?.honorario?.caso)}</TableCell>
                    <TableCell>{new Date(cuota.vencimiento).toLocaleDateString('es-AR')}</TableCell>
                    <TableCell align="right">{formatCurrency(cuota.calc?.montoTotal || 0, "ARS")}</TableCell>
                    <TableCell align="right">{formatCurrency(cuota.calc?.pagado || 0, "ARS")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCurrency(cuota.calc?.saldo || 0, "ARS")}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={`${cuota.calc?.percPagado || 0}%`}
                        size="small"
                        color={cuota.calc?.percPagado >= 100 ? "success" : cuota.calc?.percPagado >= 50 ? "warning" : "error"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={cuota.estado?.nombre || (cuota.calc?.percPagado >= 100 ? "Pagada" : "Pendiente")}
                        size="small"
                        color={cuota.estado?.codigo === "PAGADA" || cuota.calc?.percPagado >= 100 ? "success" : "error"}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {data && (
        <TablePagination
          component="div"
          count={data.total || 0}
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

