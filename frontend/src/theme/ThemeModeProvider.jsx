// src/theme/ThemeModeProvider.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider, CssBaseline, useMediaQuery } from "@mui/material";
import { createAppTheme } from "../theme"; // importa la fábrica del theme que hicimos

const ThemeModeContext = createContext({
  mode: "light",
  toggle: () => {},
  setMode: () => {},
});

const STORAGE_KEY = "lex-theme-mode";

export function ThemeModeProvider({ children }) {
  // preferencia del sistema (por si no hay nada en storage)
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return systemPrefersDark ? "dark" : "light";
  });

  // si cambia la preferencia del sistema y no hay elección guardada, podrías sincronizar aquí
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) setMode(systemPrefersDark ? "dark" : "light");
  }, [systemPrefersDark]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  const value = useMemo(
    () => ({
      mode,
      setMode,
      toggle: () => setMode((m) => (m === "light" ? "dark" : "light")),
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
