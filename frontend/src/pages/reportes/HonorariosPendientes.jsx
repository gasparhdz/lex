// src/pages/reportes/HonorariosPendientes.jsx
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
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  LinearProgress,
  TablePagination,
  Alert,
  TextField,
  Autocomplete,
  Paper,
} from "@mui/material";
import { ArrowBack, Download, Search, ExpandMore, ExpandLess, ArrowUpward, ArrowDownward } from "@mui/icons-material";
import { DatePicker } from "@mui/x-date-pickers";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { esES } from "@mui/x-date-pickers/locales";
import api from "../../api/axios";
import { displayCliente, displayExpte } from "../../utils/finanzas";
import { formatCurrency } from "../../utils/format";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";

export default function HonorariosPendientes() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [fechaCorte, setFechaCorte] = useState(dayjs());
  const [clienteSearch, setClienteSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [sortBy, setSortBy] = useState({ field: "cliente", order: "asc" });
  const [selectedCliente, setSelectedCliente] = useState(null);

  const params = useMemo(() => ({
    page: page + 1,
    pageSize,
    al: fechaCorte.format("YYYY-MM-DD"),
  }), [page, pageSize, fechaCorte]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["reportes", "honorarios-pendientes", params],
    queryFn: () => api.get("/finanzas/reportes/cobranzas-pendientes", { params }).then(r => r.data),
  });

  // Obtener clientes para el autocomplete
  const { data: clientesData } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => api.get("/clientes", { params: { pageSize: 1000 } }).then(r => r.data?.data || []),
  });

  // Valor JUS de corte para conversión
  const valorJUS = data?.data?.[0]?.honorarios?.[0]?.calc?.vjCorte;

  // Procesar y ordenar datos
  const processedData = useMemo(() => {
    if (!data?.data) return [];
    
    // Filtrar por cliente si hay búsqueda
    let filtered = data.data;
    if (clienteSearch) {
      filtered = data.data.filter(cg => 
        displayCliente(cg.cliente).toLowerCase().includes(clienteSearch.toLowerCase())
      );
    }

    // Ordenar
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy.field === "cliente") {
        const nameA = displayCliente(a.cliente);
        const nameB = displayCliente(b.cliente);
        return sortBy.order === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else if (sortBy.field === "saldo") {
        return sortBy.order === "asc" ? a.totalSaldoARS - b.totalSaldoARS : b.totalSaldoARS - a.totalSaldoARS;
      }
      return 0;
    });

    return sorted;
  }, [data, clienteSearch, sortBy]);

  // Aplicar paginación
  const paginatedData = useMemo(() => {
    if (!processedData) return [];
    const start = page * pageSize;
    const end = start + pageSize;
    return processedData.slice(start, end);
  }, [processedData, page, pageSize]);

  // Calcular % pagado por cliente
  const getPercPagado = (totalJus, cobradoJus) => {
    if (!totalJus || totalJus === 0) return 0;
    return (cobradoJus / totalJus) * 100;
  };

  // Datos para el gráfico
  const chartData = useMemo(() => {
    if (!processedData?.length) return [];
    
    const totals = processedData.reduce((acc, cg) => {
      const totalJusARS = valorJUS ? (cg.totalTotalJus * valorJUS) : 0;
      const cobradoJusARS = valorJUS ? (cg.totalCobradoJus * valorJUS) : 0;
      return {
        total: acc.total + totalJusARS,
        cobrado: acc.cobrado + cobradoJusARS,
        saldo: acc.saldo + (cg.totalSaldoARS || 0),
      };
    }, { total: 0, cobrado: 0, saldo: 0 });

    return [
      { name: "Cobrado", value: totals.cobrado, color: "#2e7d32" },
      { name: "Saldo", value: totals.saldo, color: "#d32f2f" },
    ];
  }, [processedData, valorJUS]);

  const COLORS = ['#2e7d32', '#d32f2f'];

  const handleExportExcel = async () => {
    try {
      const allData = await api.get("/finanzas/reportes/cobranzas-pendientes", {
        params: { page: 1, pageSize: 10000, al: fechaCorte.format("YYYY-MM-DD") },
      }).then(r => r.data?.data || []);

      const wsData = [
        ["Cliente", "Caso", "Concepto", "Total JUS", "Cobrado JUS", "Saldo JUS", "Saldo ARS"],
      ];
      
      allData.forEach(clienteGroup => {
        clienteGroup.honorarios.forEach(h => {
          wsData.push([
            displayCliente(clienteGroup.cliente),
            displayExpte(h.caso),
            h.concepto?.nombre || "-",
            h.calc?.totalJus || 0,
            h.calc?.cobradoJus || 0,
            h.calc?.saldoJus || 0,
            h.calc?.saldoARSAlCorte || 0,
          ]);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Honorarios Pendientes");
      XLSX.writeFile(wb, `Honorarios_Pendientes_${fechaCorte.format("YYYY-MM-DD")}.xlsx`);
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
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Honorarios Pendientes
            </Typography>
            
          </Box>
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

        {/* Filtros */}
        <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
            <Autocomplete
              options={clientesData || []}
              getOptionLabel={(option) => displayCliente(option)}
              value={selectedCliente}
              onChange={(_, newValue) => {
                setSelectedCliente(newValue);
                setClienteSearch(newValue ? displayCliente(newValue) : "");
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
              <Tooltip title="Ingresos a considerar hasta esta fecha">
                <div>
                  <DatePicker
                    label="Fecha de corte"
                    value={fechaCorte}
                    onChange={setFechaCorte}
                    slotProps={{
                      textField: { size: "small", sx: { width: 200 } },
                    }}
                  />
                </div>
              </Tooltip>
            </LocalizationProvider>
          </Stack>
        </Paper>
      </Box>

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
                    Total Honorarios
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
                      Cobrado
                    </Typography>
                    <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: "#2e7d32" }} />
                  </Box>
                  <Typography variant="h5" fontWeight={700} color="success.main">
                    {formatCurrency(cobrado, "ARS")}
                  </Typography>
                  <Typography variant="caption" color="success.dark">
                    {percCobrado}% del total
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
                    {formatCurrency(saldo, "ARS")}
                  </Typography>
                  <Typography variant="caption" color="error.dark">
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
                      <Typography variant="body2" color="text.secondary">Progreso de Cobranza</Typography>
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption" color="success.main">Cobrado ({percCobrado}%)</Typography>
                        <Typography variant="caption" fontWeight={600}>{formatCurrency(cobrado, "ARS")}</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Number(percCobrado)} 
                        sx={{ height: 8, borderRadius: 1, bgcolor: "error.100" }}
                      />
                    </Box>
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="caption" color="error.main">Pendiente ({percSaldo}%)</Typography>
                        <Typography variant="caption" fontWeight={600}>{formatCurrency(saldo, "ARS")}</Typography>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={Number(percSaldo)} 
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
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="right">Cobrado</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5, cursor: "pointer" }} onClick={() => handleSort("saldo")}>
                      Saldo
                      {sortBy.field === "saldo" && (sortBy.order === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />)}
                    </Box>
                  </TableCell>
                  <TableCell align="center">% Pagado</TableCell>
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
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <CircularProgress />
                      </TableCell>
                    </TableRow>
                  ) : !processedData?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        No hay honorarios pendientes para esta fecha de corte
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((clienteGroup) => {
                      const totalJusARS = valorJUS ? (clienteGroup.totalTotalJus * valorJUS) : 0;
                      const cobradoJusARS = valorJUS ? (clienteGroup.totalCobradoJus * valorJUS) : 0;
                      const percPagado = getPercPagado(clienteGroup.totalTotalJus, clienteGroup.totalCobradoJus);

                      return (
                      <React.Fragment key={clienteGroup.clienteId}>
                        <TableRow 
                          hover
                          sx={{ cursor: "pointer" }}
                          onClick={() => {
                            const newExpanded = new Set(expandedClients);
                            if (newExpanded.has(clienteGroup.clienteId)) {
                              newExpanded.delete(clienteGroup.clienteId);
                            } else {
                              newExpanded.add(clienteGroup.clienteId);
                            }
                            setExpandedClients(newExpanded);
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {expandedClients.has(clienteGroup.clienteId) ? 
                                <ExpandLess /> : <ExpandMore />}
                              <Typography fontWeight={600}>
                                {displayCliente(clienteGroup.cliente)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(totalJusARS, "ARS")}</TableCell>
                          <TableCell align="right">{formatCurrency(cobradoJusARS, "ARS")}</TableCell>
                          <TableCell align="right">{formatCurrency(clienteGroup.totalSaldoARS || 0, "ARS")}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${percPagado.toFixed(0)}%`}
                              size="small"
                              color={percPagado >= 100 ? "success" : percPagado >= 50 ? "warning" : "error"}
                            />
                          </TableCell>
                        </TableRow>
                        {expandedClients.has(clienteGroup.clienteId) && (
                          <TableRow>
                            <TableCell colSpan={5} sx={{ py: 0, borderBottom: 0 }}>
                              <Box sx={{ p: 2, bgcolor: (t) => t.palette.mode === "dark" ? "background.default" : "#f9f9f9" }}>
                                <Table
                                  size="small"
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
                                      <TableCell>Caso</TableCell>
                                      <TableCell>Concepto</TableCell>
                                      <TableCell align="right">Saldo</TableCell>
                                      <TableCell align="center">% Cobrado</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {clienteGroup.honorarios.map((h) => (
                                      <TableRow key={h.id}>
                                        <TableCell>{displayExpte(h.caso)}</TableCell>
                                        <TableCell>{h.concepto?.nombre || "-"}</TableCell>
                                        <TableCell align="right">{formatCurrency(h.calc?.saldoARSAlCorte || 0, "ARS")}</TableCell>
                                        <TableCell align="center">
                                          <Chip
                                            label={`${(h.calc?.percCobrado * 100 || 0).toFixed(0)}%`}
                                            size="small"
                                            color={h.calc?.percCobrado >= 1 ? "success" : "warning"}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                    })
                  )}  
              </TableBody>
            </Table>
          </Box>
        </Paper>

        {processedData.length > 0 && (
          <TablePagination
            component="div"
            count={processedData.length}
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

