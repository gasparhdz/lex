// src/components/SectionCard.jsx
import React from "react";
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Collapse,
  Stack,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

/**
 * Componente de contenedor reutilizable para secciones tipo “card”.
 *
 * Props:
 * - title: string — título de la sección
 * - expanded: boolean — controla si el contenido está expandido
 * - onToggle: función — se ejecuta al hacer clic en el header
 * - actions: ReactNode — (opcional) elementos a la derecha del título
 * - children: contenido interno de la card
 * - noCollapse: boolean — si true, no muestra iconos de expandir/colapsar
 * - sx: estilos adicionales
 */
export default function SectionCard({
  title,
  expanded = true,
  onToggle,
  actions,
  children,
  noCollapse = false,
  sx,
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 2,
        borderRadius: 3,
        overflow: "hidden",
        border: (t) => `1px solid ${t.palette.divider}`,
        ...sx,
      }}
    >
      {/* ===== Header ===== */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 2,
          py: 1.25,
          cursor: onToggle ? "pointer" : "default",
          backgroundColor: (t) =>
            t.palette.mode === "dark"
              ? t.palette.background.paper
              : t.palette.grey[50],
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
        }}
        onClick={onToggle}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, letterSpacing: 0.2 }}
          >
            {title}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {actions}
          {!noCollapse && onToggle && (
            <IconButton size="small">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Stack>
      </Box>

      {/* ===== Contenido ===== */}
      {noCollapse ? (
        <Box sx={{ p: 2 }}>{children}</Box>
      ) : (
        <Collapse in={expanded}>
          <Box sx={{ p: 2 }}>{children}</Box>
        </Collapse>
      )}
    </Paper>
  );
}
