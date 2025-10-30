// src/pages/Finanzas.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Tabs, Tab, Paper, Typography } from "@mui/material";
import Ingresos from "./Ingresos";
import Honorarios from "./Honorarios";
import Gastos from "./Gastos";

const TABS = [
  { key: "honorarios", label: "Honorarios" },
  { key: "gastos", label: "Gastos" },
  { key: "ingresos", label: "Ingresos" },
];

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`finanzas-tabpanel-${index}`}
      aria-labelledby={`finanzas-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function Finanzas() {
  const location = useLocation();
  const navigate = useNavigate();

  const tabKeyFromUrl = useMemo(() => {
    const q = new URLSearchParams(location.search);
    return q.get("tab") || "honorarios";
  }, [location.search]);

  const indexFromKey = (key) => {
    const i = TABS.findIndex((t) => t.key === key);
    return i >= 0 ? i : 0;
  };

  const [tab, setTab] = useState(indexFromKey(tabKeyFromUrl));

  useEffect(() => {
    setTab(indexFromKey(tabKeyFromUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKeyFromUrl]);

  const handleChange = (_e, newIndex) => {
    setTab(newIndex);
    const key = TABS[newIndex].key;
    const q = new URLSearchParams(location.search);
    q.set("tab", key);
    navigate({ pathname: location.pathname, search: q.toString() }, { replace: true });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 2,
        p: 2,
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => (t.palette.mode === 'dark' ? 'background.paper' : '#fff'),
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Finanzas
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={handleChange} aria-label="finanzas tabs">
          {TABS.map((t, idx) => (
            <Tab key={t.key} label={t.label} id={`finanzas-tab-${idx}`} />
          ))}
        </Tabs>
      </Box>

      <TabPanel value={tab} index={0}>
        <Honorarios />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <Gastos />
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <Ingresos />
      </TabPanel>
    </Paper>
  );
}
