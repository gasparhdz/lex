// src/theme.js
import { createTheme } from "@mui/material/styles";

// ===== Paletas base (tuyas) =====
const primary = {
  main: "#2F3A4F", // azul indigo sobrio
  light: "#5F7BD1",
  dark: "#2A4280",
  contrastText: "#FFFFFF",
};
const secondary = {
  main: "#1E88E5",
  light: "#33B6AE",
  dark: "#00766F",
  contrastText: "#FFFFFF",
};
const greyLight = {
  50:  "#F6F7FA",
  100: "#EFF1F5",
  200: "#E3E7EE",
  300: "#D2D9E4",
  400: "#B7C1D1",
  500: "#9AA7BC",
  600: "#7C8AA3",
  700: "#5E6B83",
  800: "#3E4A60",
  900: "#1F2633",
};

// Un set de grises para modo oscuro que combine con tu estética
const greyDark = {
  50:  "#0F172A",
  100: "#131C31",
  200: "#16203A",
  300: "#1C2747",
  400: "#293553",
  500: "#3A4766",
  600: "#526084",
  700: "#7A89A9",
  800: "#AEB9CC",
  900: "#E2E7F0",
};

// ===== Fábrica de tema por modo =====
export function createAppTheme(mode = "light") {
  const isDark = mode === "dark";
  const grey = isDark ? greyDark : greyLight;

  return createTheme({
    palette: {
      mode,
      primary,
      secondary,
      background: {
        default: isDark ? grey[50] : grey[50],        // fondo app
        paper:   isDark ? grey[100] : "#FFFFFF",      // superficies (cards, drawer)
      },
      text: {
        primary: isDark ? greyDark[900] : greyLight[900],
        secondary: isDark ? greyDark[700] : greyLight[700],
      },
      divider: isDark ? "rgba(255,255,255,0.12)" : greyLight[300],
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: [
        "Inter",
        "Segoe UI",
        "Roboto",
        "Helvetica Neue",
        "Arial",
        "sans-serif",
      ].join(","),
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: isDark
            ? {
                // fondo sutil en oscuro
                backgroundImage:
                  "radial-gradient(60rem 60rem at 120% -10%, rgba(46,74,140,0.12), transparent 40%), radial-gradient(50rem 50rem at -10% 120%, rgba(28,74,90,0.10), transparent 45%)",
              }
            : {
                // tu fondo en claro
                backgroundImage:
                  "radial-gradient(60rem 60rem at 120% -10%, rgba(62,95,180,0.08), transparent 40%), radial-gradient(50rem 50rem at -10% 120%, rgba(0,163,154,0.06), transparent 45%)",
              },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            borderRadius: 0, // ¡sin bordes redondeados!
            backgroundColor: isDark ? primary.main : primary.main, // sólido en ambos
            color: primary.contrastText,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : greyLight[200]}`,
            backgroundColor: isDark ? grey[100] : "#FFFFFF",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            margin: "4px 8px",
            "&.Mui-selected": {
              backgroundColor: isDark ? "rgba(62,95,180,0.22)" : greyLight[100],
              "&:hover": {
                backgroundColor: isDark ? "rgba(62,95,180,0.30)" : greyLight[200],
              },
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: isDark
              ? "0 2px 6px rgba(0,0,0,0.40), 0 14px 28px rgba(0,0,0,0.30)"
              : "0 2px 6px rgba(0,0,0,0.06), 0 14px 28px rgba(30,42,70,0.06)",
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 10, paddingInline: 16 },
          containedSecondary: { color: "#fff" },
        },
        variants: [
          {
            props: { variant: "outlined" },
            style: {
              color: isDark ? greyDark[900] : primary.main,
              borderColor: isDark ? "rgba(226,231,240,0.28)" : greyLight[300],
              backgroundColor: "transparent",
              "&:hover": {
                borderColor: isDark ? "rgba(226,231,240,0.48)" : greyLight[400],
                backgroundColor: isDark ? "rgba(226,231,240,0.06)" : greyLight[100],
              },
              "&.Mui-disabled": {
                color: isDark ? "rgba(226,231,240,0.38)" : greyLight[500],
                borderColor: isDark ? "rgba(226,231,240,0.12)" : greyLight[200],
              },
            },
          },
          // (opcional) outlined para color="error", por si lo usás en diálogos
          {
            props: { variant: "outlined", color: "error" },
            style: {
              color: isDark ? "#ffb4ab" : "#d32f2f",
              borderColor: isDark ? "rgba(255,180,171,0.35)" : "#ef9a9a",
              "&:hover": {
                borderColor: isDark ? "rgba(255,180,171,0.55)" : "#e57373",
                backgroundColor: isDark ? "rgba(255,180,171,0.08)" : "#fdecec",
              },
            },
          },
        ],
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : greyLight[100],
            "& .MuiTableCell-head": { fontWeight: 600 },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            height: 36,
            '&:last-child td, &:last-child th': { border: 0 },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            paddingTop: 2,     // padding vertical más chico
            paddingBottom: 2,
            paddingLeft: 12,   // podés ajustarlo si querés más compacto
            paddingRight: 12,
            fontSize: 12,      // un poco más pequeña la fuente
            lineHeight: 0.5,
            borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : greyLight[300]}`,
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: "small",
          variant: "outlined",
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16 },
        },
      },
      MuiToolbar: {
        styleOverrides: {
          root: { minHeight: 64 },
        },
      },
    },
  });
}

// ===== Export por defecto (modo claro) para NO romper tu app actual =====
const theme = createAppTheme("light");
export default theme;
