// src/pages/reportes/GastosPendientes.jsx
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

export default function GastosPendientes() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState({ field: "cliente", order: "asc" });
  const [periodo, setPeriodo] = useState(null);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [clienteSearch, setClienteSearch] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);

  const params = useMemo(() => {
    const p = {
      page: page + 1,
      pageSize,
    };
    
    // Solo agregar filtros de fecha si hay un período seleccionado
    if (periodo) {
      p.from = periodo.startOf('month').toISOString();
      p.to = periodo.endOf('month').toISOString();
    }
    
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
    queryKey: ["reportes", "gastos-pendientes", params],
    queryFn: () => api.get("/finanzas/reportes/gastos-pendientes-reintegro", { params }).then(r => r.data),
  });

  // Procesar y ordenar datos
  const processedData = useMemo(() => {
    if (!data?.data) return data?.data || [];
    
    // Filtrar solo pendientes si está activado
    let filtered = [...data.data];
    if (soloPendientes) {
      filtered = filtered.filter(g => g.calc?.saldoARS > 0);
    }
    
    // Ordenar
    const sorted = filtered.sort((a, b) => {
      if (sortBy.field === "cliente") {
        const nameA = displayCliente(a.cliente);
        const nameB = displayCliente(b.cliente);
        return sortBy.order === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else if (sortBy.field === "saldo") {
        return sortBy.order === "asc" ? a.calc?.saldoARS - b.calc?.saldoARS : b.calc?.saldoARS - a.calc?.saldoARS;
      }
      return 0;
    });

    return sorted;
  }, [data, sortBy, soloPendientes]);

  const handleExportExcel = async () => {
    try {
      const exportParams = {
        page: 1,
        pageSize: 10000,
      };
      
      if (periodo) {
        exportParams.from = periodo.startOf('month').toISOString();
        exportParams.to = periodo.endOf('month').toISOString();
      }
      
      if (selectedCliente) {
        exportParams.clienteId = selectedCliente.id;
      }
      
      const allData = await api.get("/finanzas/reportes/gastos-pendientes-reintegro", {
        params: exportParams,
      }).then(r => r.data?.data || []);

      const wsData = [
        ["Cliente", "Caso", "Fecha Gasto", "Total ARS", "Cobrado ARS", "Saldo ARS"],
      ];
      
      allData.forEach(g => {
        wsData.push([
          displayCliente(g.cliente),
          displayExpte(g.caso),
          new Date(g.fechaGasto).toLocaleDateString('es-AR'),
          g.calc?.totalARS || 0,
          g.calc?.aplicadoARS || 0,
          g.calc?.saldoARS || 0,
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Gastos Pendientes");
      const fileName = periodo ? `Gastos_Pendientes_${periodo.format('YYYY-MM')}.xlsx` : `Gastos_Pendientes_historico.xlsx`;
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

  // Datos para el gráfico
  const chartData = useMemo(() => {
    if (!data?.data) return [];
    
    const totals = data.data.reduce((acc, g) => ({
      total: acc.total + (g.calc?.totalARS || 0),
      cobrado: acc.cobrado + (g.calc?.aplicadoARS || 0),
      saldo: acc.saldo + (g.calc?.saldoARS || 0),
    }), { total: 0, cobrado: 0, saldo: 0 });

    return [
      { name: "Cobrado", value: totals.cobrado, color: "#1976d2" },
      { name: "Saldo", value: totals.saldo, color: "#ed6c02" },
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
            Gastos Pendientes de Reintegro
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
              setClienteSearch(newValue ? displayCliente(newValue) : "");
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
            <Tooltip title="Selecciona el mes para el análisis (opcional)">
              <div>
                <DatePicker
                  label="Período (opcional)"
                  value={periodo}
                  onChange={(newValue) => {
                    setPeriodo(newValue);
                    setPage(0); // Resetear página al cambiar período
                  }}
                  views={['year', 'month']}
                  format="MMMM YYYY"
                  slotProps={{
                    textField: { 
                      size: "small", 
                      sx: { width: 200 },
                      placeholder: "Todos los períodos"
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

      {/* Cards de Resumen */}
      {chartData.length > 0 && (() => {
        const total = chartData.reduce((acc, d) => acc + d.value, 0);
        const cobrado = chartData[0]?.value || 0;
        const saldo = chartData[1]?.value || 0;
        const percCobrado = total > 0 ? ((cobrado / total) * 100).toFixed(1) : 0;
        const percSaldo = total > 0 ? ((saldo / total) * 100).toFixed(1) : 0;
        
        return (
          <>
            {/* Cards de Métricas */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mb: 2 }}>
              <Card sx={{ bgcolor: "info.50" }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Total Gastos
                  </Typography>
                  <Typography variant="h5" fontWeight={700} color="primary">
                    {formatCurrency(total, "ARS")}
                  </Typography>
                </CardContent>
              </Card>
              
              <Card sx={{ bgcolor: "info.50", border: "2px solid", borderColor: "info.main" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="caption" color="info.dark" display="block" fontWeight={600}>
                      Cobrado
                    </Typography>
                    <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#1976d2" }} />
                  </Box>
                  <Typography variant="h5" fontWeight={700} color="info.main">
                    {formatCurrency(cobrado, "ARS")}
                  </Typography>
                  <Typography variant="caption" color="info.dark">
                    {percCobrado}% del total
                  </Typography>
                </CardContent>
              </Card>
              
              <Card sx={{ bgcolor: "warning.50", border: "2px solid", borderColor: "warning.main" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="caption" color="warning.dark" display="block" fontWeight={600}>
                      Saldo Pendiente
                    </Typography>
                    <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#ed6c02" }} />
                  </Box>
                  <Typography variant="h5" fontWeight={700} color="warning.main">
                    {formatCurrency(saldo, "ARS")}
                  </Typography>
                  <Typography variant="caption" color="warning.dark">
                    {percSaldo}% del total
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
                      {percCobrado}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Cobrado
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ flex: 1 }}>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" color="text.secondary">Progreso de Reintegro</Typography>
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption" color="info.main">Cobrado ({percCobrado}%)</Typography>
                        <Typography variant="caption" fontWeight={600}>{formatCurrency(cobrado, "ARS")}</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Number(percCobrado)} 
                        sx={{ height: 8, borderRadius: 1, bgcolor: "warning.100" }}
                      />
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption" color="warning.main">Pendiente ({percSaldo}%)</Typography>
                        <Typography variant="caption" fontWeight={600}>{formatCurrency(saldo, "ARS")}</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Number(percSaldo)} 
                        color="warning"
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
          label="Mostrar solo gastos con saldo pendiente"
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
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }} onClick={() => handleSort("cliente")}>
                    Cliente
                    {sortBy.field === "cliente" && (sortBy.order === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                  </Box>
                </TableCell>
                <TableCell>Caso</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Cobrado</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5, cursor: "pointer" }} onClick={() => handleSort("saldo")}>
                    Saldo
                    {sortBy.field === "saldo" && (sortBy.order === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                  </Box>
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : !processedData?.length ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    No hay gastos para mostrar
                  </TableCell>
                </TableRow>
              ) : (
                processedData.map((gasto) => (
                  <TableRow key={gasto.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{displayCliente(gasto.cliente)}</TableCell>
                    <TableCell>{displayExpte(gasto.caso)}</TableCell>
                    <TableCell>{new Date(gasto.fechaGasto).toLocaleDateString('es-AR')}</TableCell>
                    <TableCell align="right">{formatCurrency(gasto.calc?.totalARS || 0, "ARS")}</TableCell>
                    <TableCell align="right">{formatCurrency(gasto.calc?.aplicadoARS || 0, "ARS")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCurrency(gasto.calc?.saldoARS || 0, "ARS")}
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

