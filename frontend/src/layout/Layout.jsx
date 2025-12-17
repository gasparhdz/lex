import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, IconButton, Typography, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, CssBaseline, Divider, Tooltip, Button, useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import CaseIcon from "@mui/icons-material/Gavel";
import EventIcon from "@mui/icons-material/Event";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import SettingsIcon from "@mui/icons-material/Settings";
import DashboardIcon from "@mui/icons-material/Dashboard";
import { useAuth } from "../auth/AuthContext";
import { useThemeMode } from "../theme/ThemeModeProvider";
import { usePermiso } from "../auth/usePermissions";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import ChecklistIcon from "@mui/icons-material/Checklist";
import EventNoteIcon from "@mui/icons-material/EventNote";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AssessmentIcon from "@mui/icons-material/Assessment";

const drawerWidth = 220;
const miniWidth = 56;
const APPBAR_H = 64;
const STORAGE_KEY = "lex-sidebar-open";

// ⚠️ ADJUNTOS DESHABILITADOS TEMPORALMENTE
const ADJUNTOS_ENABLED = false;

const navItems = [
  { to: "/", label: "Inicio", icon: <DashboardIcon />, modulo: "DASHBOARD" },
  { to: "/clientes", label: "Clientes", icon: <PeopleIcon />, modulo: "CLIENTES" },
  { to: "/casos", label: "Casos", icon: <CaseIcon />, modulo: "CASOS" },
  { to: "/agenda", label: "Agenda", icon: <CalendarMonthIcon  />, modulo: "AGENDA" },
  { to: "/tareas", label: "Tareas", icon: <ChecklistIcon />, modulo: "TAREAS" },
  { to: "/eventos", label: "Eventos", icon: <EventIcon />, modulo: "EVENTOS" },
  { to: "/finanzas", label: "Finanzas", icon: <AttachMoneyIcon />, modulo: "FINANZAS" },
  { to: "/reportes", label: "Reportes", icon: <AssessmentIcon />, modulo: "FINANZAS" },
  ...(ADJUNTOS_ENABLED ? [{ to: "/adjuntos", label: "Adjuntos", icon: <InsertDriveFileIcon />, modulo: "ADJUNTOS" }] : []),
  { to: "/usuarios", label: "Usuarios", icon: <PersonIcon />, modulo: "USUARIOS" },
  { to: "/configuracion", label: "Configuración", icon: <SettingsIcon />, modulo: "CONFIGURACION" },
];

export default function Layout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? saved === "1" : true;
  });
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  const [mobileOpen, setMobileOpen] = useState(false);

  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { mode, toggle } = useThemeMode();

  // Filtrar items del menú según permisos
  const canView = (modulo) => {
    if (!user?.permisos) return false;
    const permiso = user.permisos.find(p => p.modulo === modulo);
    return permiso?.ver === true;
  };

  const visibleNavItems = navItems.filter(item => {
    // Configuración siempre visible (Dashboard ya no requiere permisos en el backend)
    if (item.modulo === 'CONFIGURACION') return true;
    if (!item.modulo) return true;
    return canView(item.modulo);
  });

  const handleMenuClick = () => {
    if (isDesktop) setOpen((v) => !v);
    else setMobileOpen((v) => !v); 
  };

  const renderItem = (item) => {
    const expanded = isDesktop ? open : true;

    const btn = (
      <ListItemButton
        key={item.to}
        component={NavLink}
        to={item.to}
        end={item.to === "/"}
        onClick={() => { if (!isDesktop) setMobileOpen(false); }} 
        sx={{
          borderRadius: 1,
          mx: 0,
          width: "100%",
          overflow: "hidden",
          my: 0.5,
          position: "relative",

          px: expanded ? 2 : 1,
          justifyContent: expanded ? "flex-start" : "center",

          "& .MuiListItemIcon-root": {
            minWidth: expanded ? 40 : "auto",
            mr: expanded ? 1 : 0,
            color: "text.secondary",
            justifyContent: "center",
          },
          "& .MuiListItemText-root": {
            opacity: expanded ? 1 : 0,
            width: expanded ? "auto" : 0,
            m: 0,
          },
          "& .MuiListItemText-primary": { fontWeight: 500 },

          "&:hover": {
            backgroundColor: (t) =>
              t.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : t.palette.grey[100],
          },

          "&.active": {
            backgroundColor: (t) =>
              alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.24 : 0.12),
            "&:hover": {
              backgroundColor: (t) =>
                alpha(t.palette.primary.main, t.palette.mode === "dark" ? 0.32 : 0.18),
            },
            "& .MuiListItemIcon-root, & .MuiListItemText-primary": {
              color: (t) =>
                t.palette.mode === "dark" ? t.palette.primary.light : t.palette.primary.main,
            },
          },
          "&.active::before": {
            content: '""',
            position: "absolute",
            left: 4,      
            top: 6,
            bottom: 6,
            width: 3,
            borderRadius: 2,
            backgroundColor: "primary.main",
          },
        }}
      >
        <ListItemIcon>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} />
      </ListItemButton>
    );

    return (isDesktop && !open)
      ? <Tooltip key={item.to} title={item.label} placement="right">{btn}</Tooltip>
      : btn;
  };

  const DrawerContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <List sx={{ flex: 1, py: 0.5, px: 1, overflowY: "auto", overflowX: "hidden" }}>
        {visibleNavItems.map(renderItem)}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", width: "100%", overflowX: "hidden" }}>
      <CssBaseline />
      {/* Top bar */}
      <AppBar position="fixed" color="primary" sx={{ zIndex: (t) => t.zIndex.drawer + 1, borderRadius: 0 }}>
        <Toolbar sx={{ minHeight: APPBAR_H }}>
          <IconButton edge="start" color="inherit" aria-label="menu" onClick={handleMenuClick} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {document.title || "Lex"}
          </Typography>
          <Tooltip title={mode === "dark" ? "Usar tema claro" : "Usar tema oscuro"}>
            <IconButton color="inherit" onClick={toggle} sx={{ mr: 1 }} aria-label="Cambiar tema">
              {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Cerrar sesión">
            <Button
              color="inherit"
              onClick={() => {
                logout();
                nav("/login", { replace: true });
              }}
            >
              Salir
            </Button>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Sidebar desktop */}
      <Drawer
        variant="persistent"
        open 
        sx={{ display: { xs: "none", md: "block" } }}
        PaperProps={{
          sx: {
            width: open ? drawerWidth : miniWidth,
            boxSizing: "border-box",
            position: "fixed",
            left: 0,
            top: `${APPBAR_H}px`,
            height: `calc(100% - ${APPBAR_H}px)`,
            borderRight: (t) => `1px solid ${t.palette.divider}`,
            overflowX: "hidden",
            overflowY: "auto",
            transition: (t) =>
              t.transitions.create("width", { duration: t.transitions.duration.shorter }),
          },
        }}
      >
        {DrawerContent}
      </Drawer>

      {/* Sidebar mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" } }}
        PaperProps={{
          sx: {
            width: drawerWidth,
            boxSizing: "border-box",
            position: "fixed",
            left: 0,
            top: `${APPBAR_H}px`,
            height: `calc(100% - ${APPBAR_H}px)`,
            borderRight: (t) => `1px solid ${t.palette.divider}`,
            overflowX: "hidden",
            overflowY: "auto",
          },
        }}
      >
        {DrawerContent}
      </Drawer>

      {/* Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 2,
          mt: `${APPBAR_H}px`,
          ml: { md: open ? `${drawerWidth}px` : `${miniWidth}px`, xs: 0 },
          width: { md: `calc(100% - ${open ? drawerWidth : miniWidth}px)`, xs: "100%" },
          boxSizing: "border-box", 
          minWidth: 0,             
          overflowX: "hidden",    
          minHeight: "100vh",
          transition: (t) =>
            t.transitions.create(["margin", "width"], { duration: t.transitions.duration.shorter }),
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: "auto", width: "100%" }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
