// src/pages/Configuracion.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Paper, Tabs, Tab, Typography
} from '@mui/material';

import ParametrosTab from '../components/configuracion/ParametrosTab';
import RolesPermisosTab from '../components/configuracion/RolesPermisosTab';
import WhatsAppTab from '../components/configuracion/WhatsAppTab';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`config-tabpanel-${index}`}
      aria-labelledby={`config-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function Configuracion() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(tabParam ? parseInt(tabParam) : 0);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setTab(parseInt(tabParam));
    }
  }, [searchParams]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
    setSearchParams({ tab: newValue.toString() });
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
          Configuración del Sistema
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={handleTabChange} aria-label="config tabs">
            <Tab label="Parámetros" />
            <Tab label="Roles y Permisos" />
            <Tab label="WhatsApp" />
          </Tabs>
        </Box>

        <TabPanel value={tab} index={0}>
          <ParametrosTab />
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <RolesPermisosTab />
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <WhatsAppTab />
        </TabPanel>
    </Paper>
  );
}

