// src/pages/Reportes.jsx
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  AccountBalanceWalletOutlined,
  ReceiptLongOutlined,
  AlarmOutlined,
  TrendingUpOutlined,
} from "@mui/icons-material";
import { motion } from "framer-motion";

const reportes = [
  {
    id: "honorarios-pendientes",
    titulo: "Honorarios",
    icono: <AccountBalanceWalletOutlined fontSize="large" />,
    color: "primary",
    ruta: "/reportes/honorarios-pendientes",
  },
  {
    id: "gastos-reintegro",
    titulo: "Gastos",
    icono: <ReceiptLongOutlined fontSize="large" />,
    color: "warning",
    ruta: "/reportes/gastos-pendientes",
  },
  {
    id: "vencimientos-periodo",
    titulo: "Vencimientos",
    icono: <AlarmOutlined fontSize="large" />,
    color: "error",
    ruta: "/reportes/vencimientos-periodo",
  },
  {
    id: "ingresos",
    titulo: "Ingresos",
    icono: <TrendingUpOutlined fontSize="large" />,
    color: "success",
    ruta: "/reportes/ingresos",
  },
  // TODO: Implementar reportes restantes
  // {
  //   id: "ingresos-periodo",
  //   titulo: "Ingresos por Período",
  //   icono: <TrendingUpOutlined fontSize="large" />,
  //   color: "success",
  //   ruta: "/reportes/ingresos-periodo",
  // },
  // {
  //   id: "gastos-periodo",
  //   titulo: "Gastos por Período",
  //   icono: <CompareArrowsOutlined fontSize="large" />,
  //   color: "error",
  //   ruta: "/reportes/gastos-periodo",
  // },
  // {
  //   id: "tareas-estado",
  //   titulo: "Tareas por Estado",
  //   icono: <ChecklistOutlined fontSize="large" />,
  //   color: "info",
  //   ruta: "/reportes/tareas-estado",
  // },
  // {
  //   id: "tareas-asignacion",
  //   titulo: "Tareas por Usuario",
  //   icono: <PeopleOutlined fontSize="large" />,
  //   color: "warning",
  //   ruta: "/reportes/tareas-asignacion",
  // },
  // {
  //   id: "eventos-tipo",
  //   titulo: "Eventos por Tipo",
  //   icono: <EventNoteOutlined fontSize="large" />,
  //   color: "success",
  //   ruta: "/reportes/eventos-tipo",
  // },
  // {
  //   id: "casos-estado",
  //   titulo: "Casos por Estado",
  //   icono: <GavelOutlined fontSize="large" />,
  //   color: "primary",
  //   ruta: "/reportes/casos-estado",
  // },
];

export default function Reportes() {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Box p={2} sx={{ width: "100%" }}>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Reportes
      </Typography>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
        {reportes.map((reporte, index) => (
          <motion.div
            key={reporte.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card
              onClick={() => navigate(reporte.ruta)}
              sx={{
                height: 100,
                cursor: "pointer",
                transition: "all 0.25s ease",
                borderLeft: `6px solid ${theme.palette[reporte.color].main}`,
                display: "flex",
                alignItems: "center",
                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow: theme.shadows[4],
                },
              }}
            >
              <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", p: 2 }}>
                <Typography variant="h6" fontWeight={600} sx={{ flex: 1 }}>
                  {reporte.titulo}
                </Typography>
                <Box color={`${reporte.color}.main`} sx={{ ml: 2, flexShrink: 0 }}>
                  {reporte.icono}
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </Box>
    </Box>
  );
}
