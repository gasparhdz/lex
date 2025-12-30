# 🧪 Checklist de Testing Manual - LexManager

## ⚠️ IMPORTANTE: Backup Antes de Empezar

Antes de comenzar el testing, **HACER BACKUP DE LA BASE DE DATOS**:
```bash
# Desde tu terminal
pg_dump -U postgres -d lexmanager > backup_pre_testing.sql
```

---

## 🎯 Testing por Módulo

### 1️⃣ AUTENTICACIÓN Y PERMISOS

#### Login/Logout 
- [v] Login con usuario válido funciona
- [v] Login con usuario inválido falla correctamente
- [v] Error de contraseña se muestra correctamente
- [v] Token se guarda en localStorage
- [v] Logout cierra sesión correctamente
- [v] Al recargar página, sesión persiste
- [v] Al hacer logout, no se puede acceder a rutas protegidas

#### Permisos
- [v] Usuario sin permiso no puede crear cliente
- [v] Usuario sin permiso no puede editar caso
- [v] Usuario sin permiso no puede ver finanzas
- [v] Usuario admin puede hacer todo
- [v] Tabs ocultos según permisos

---

### 2️⃣ CLIENTES

#### Crear Cliente
- [v] Crear persona física con DNI funciona
- [v] Crear persona jurídica con CUIT funciona
- [v] Validación CUIT funciona (11 dígitos válidos)
- [v] Validación DNI funciona	
- [v] Validación email funciona
- [v] Validación teléfono funciona
- [v] Auto-generación de nombre carpeta Drive funciona
- [v] Campos opcionales se pueden dejar vacíos
- [v] Mensaje de éxito al crear
- [v] Redirección a detalle del cliente

#### Editar Cliente
- [v] Editar datos funciona
- [v] Cambio de tipo persona funciona
- [v] Historial se registra
- [v] Campos calculados no se pierden

#### Detalle Cliente
- [ ] Todos los tabs se muestran
- [ ] Casos del cliente se listan
- [ ] Tareas del cliente se listan
- [ ] Eventos del cliente se listan
- [ ] Honorarios se calculan bien
- [ ] Gastos se calculan bien
- [ ] Ingresos se calculan bien
- [ ] Notas se muestran
- [v] Timeline muestra historial
- [ ] Adjuntos se listan

#### Búsqueda Cliente
- [v] Búsqueda por nombre funciona
- [v] Búsqueda por DNI funciona
- [v] Búsqueda por CUIT funciona
- [v] Búsqueda por razón social funciona
- [v] Filtros múltiples funcionan
- [v] Paginación funciona

---

### 3️⃣ CASOS

#### Crear Caso
- [v] Crear caso con cliente funciona
- [v] Número expediente es obligatorio--OPCIONAL A PARTIR DE AHORA
- [v] Carátula es obligatoria--OPCIONAL A PARTIR DE AHORA
- [v] Tipo caso se selecciona correctamente
- [v] Estado caso se configura
- [v] Radicación se configura
- [v] Generación de carpeta Drive funciona
- [v] Número correlativo Drive se asigna
- [v] Mensaje de éxito
- [v] Redirección a detalle del caso

#### Editar Caso
- [v] Editar datos funciona
- [v] Cambio de estado funciona
- [v] Historial se registra
- [v] Auditoría funciona

#### Detalle Caso
- [v] Tabs se muestran correctamente
- [ ] Tareas del caso se listan
- [ ] Eventos del caso se listan
- [ ] Honorarios vinculados se muestran
- [ ] Gastos vinculados se muestran
- [ ] Ingresos vinculados se muestran	
- [v] Notas del caso funcionan
- [v] Timeline muestra cambios
- [v] Adjuntos se listan

#### Búsqueda Caso
- [v] Búsqueda por expediente funciona
- [v] Búsqueda por carátula funciona
- [v] Búsqueda por cliente funciona
- [v] Filtros por estado funcionan
- [v] Filtros por tipo funcionan

---

### 4️⃣ EVENTOS

#### Crear Evento
- [v] Crear evento con cliente funciona
- [v] Crear evento sin cliente funciona
- [v] Crear evento con caso funciona
- [v] Crear evento sin caso funciona
- [v] Fecha inicio es obligatoria
- [v] Tipo evento se selecciona
- [X] Todo el día funciona
- [v] Recordatorio se configura
- [v] Ubicación se guarda
- [v] Mensaje de éxito

#### Editar Evento
- [v] Editar funciona
- [v] Cambio de fecha funciona
- [v] Cambio de estado funciona

#### Lista Eventos
- [v] Eventos se listan cronológicamente
- [X] Filtros por fecha funcionan
- [v] Filtros por cliente funcionan
- [v] Filtros por tipo funcionan

#### Agenda
- [v] Vista mensual muestra eventos
- [v] Vista semanal muestra eventos
- [v] Click en fecha crea evento
- [v] Click en evento edita evento
- [v] Eventos con recordatorio se muestran

---

### 5️⃣ TAREAS

#### Crear Tarea
- [v] Crear tarea con cliente funciona
- [v] Crear tarea con caso funciona
- [v] Crear tarea sin cliente funciona
- [v] Crear tarea sin caso funciona
- [v] Título es obligatorio
- [v] Prioridad se selecciona
- [v] Fecha límite funciona
- [v] Asignación a usuario funciona
- [v] Recordatorio funciona
- [v] Subtareas se agregan
- [v] Mensaje de éxito

#### Completar Tarea
- [v] Marcar como completada funciona
- [v] Sub-tareas se completan
- [ ] "Completar todo" funciona
- [v] Fecha de completado se registra

#### Editar Tarea
- [v] Editar funciona
- [v] Agregar subtareas funciona
- [v] Editar subtareas funciona
- [v] Eliminar subtareas funciona

#### Lista Tareas
- [v] Tareas pendientes se listan
- [v] Filtros funcionan
- [v] Búsqueda funciona
- [v] Paginación funciona

---

### 6️⃣ HONORARIOS

#### Crear Honorario
- [v] Crear con cliente funciona
- [v] Crear con caso funciona
- [v] Concepto es obligatorio
- [v] Parte es obligatoria
- [v] Monto en JUS funciona
- [v] Monto en pesos funciona
- [v] Conversión automática funciona
- [v] Valor JUS de referencia funciona
- [v] Política JUS funciona
- [v] Estado funciona
- [v] Mensaje de éxito

#### Planes de Pago
- [v] Crear plan de pago funciona
- [v] Número de cuotas funciona
- [v] Frecuencia funciona
- [v] Monto por cuota se calcula
- [v] Primera cuota en fecha funciona
- [v] Valor JUS se snapshotea

#### Aplicar Ingresos
- [ ] Aplicar ingreso a cuota funciona
- [ ] Monto se distribuye correctamente
- [ ] Estado cuota cambia
- [ ] Estado plan cambia
- [ ] Cálculos son correctos

#### Lista Honorarios
- [ ] Honorarios se listan
- [ ] Filtros funcionan
- [ ] Totales se calculan
- [ ] Exportar funciona (si aplica)

---

### 7️⃣ GASTOS

#### Crear Gasto
- [ ] Crear con cliente funciona
- [ ] Crear con caso funciona
- [ ] Concepto funciona
- [ ] Monto funciona
- [ ] Moneda funciona (ARS/USD/EUR)
- [ ] Cotización funciona
- [ ] Conversión a ARS funciona
- [ ] Fecha se guarda
- [ ] Mensaje de éxito

#### Aplicar Ingreso
- [ ] Aplicar ingreso a gasto funciona
- [ ] Monto aplicado se registra
- [ ] Saldo se calcula

#### Lista Gastos
- [ ] Gastos se listan
- [ ] Filtros funcionan
- [ ] Totales se calculan

---

### 8️⃣ INGRESOS

#### Crear Ingreso
- [ ] Crear con cliente funciona
- [ ] Crear con caso funciona
- [ ] Monto funciona
- [ ] Moneda funciona
- [ ] Cotización funciona
- [ ] Valor JUS al cobro funciona
- [ ] Conversión funciona
- [ ] Tipo funciona
- [ ] Estado funciona
- [ ] Mensaje de éxito

#### Aplicar a Cuotas/Gastos
- [ ] Aplicar a cuota funciona
- [ ] Aplicar a gasto funciona
- [ ] Montos se distribuyen
- [ ] Estados cambian

#### Lista Ingresos
- [ ] Ingresos se listan
- [ ] Filtros funcionan
- [ ] Totales se calculan

---

### 9️⃣ ADJUNTOS Y GOOGLE DRIVE

#### Google Drive - Clientes
- [ ] Crear carpeta de cliente funciona
- [ ] Nombre carpeta es correcto
- [ ] Carpeta se crea en Drive
- [ ] ID se guarda en BD
- [ ] Vincular carpeta existente funciona
- [ ] Validación de nombre funciona
- [ ] Sufijo si existe funciona (2), (3), etc.

#### Google Drive - Casos
- [ ] Crear carpeta de caso funciona
- [ ] Número correlativo se asigna
- [ ] Nombre es correcto (NN - Carátula)
- [ ] Carpeta dentro de cliente funciona
- [ ] Vinculación funciona

#### Subir Archivos
- [ ] Subir archivo a cliente funciona
- [ ] Subir archivo a caso funciona
- [ ] Validación de tipo funciona (PDF, JPG, etc.)
- [ ] Validación de tamaño funciona (50MB)
- [ ] Archivo se sube a Drive
- [ ] Metadata se guarda en BD
- [ ] Mensaje de éxito

#### Listar Adjuntos
- [ ] Adjuntos se listan
- [ ] Metadata se muestra
- [ ] Autor se muestra
- [ ] Fecha se muestra
- [ ] Tamaño se muestra

#### Sincronizar
- [ ] Sincronización manual funciona
- [ ] Sincronización automática al entrar funciona
- [ ] Archivos nuevos se indexan
- [ ] Archivos eliminados se marcan
- [ ] Mensaje "Sincronizado correctamente"

#### Ver/Eliminar
- [ ] Ver archivo en Drive funciona
- [ ] Descargar funciona
- [ ] Eliminar funciona (soft delete)
- [ ] Confirmación de eliminación

---

### 🔟 RECORDATORIOS

#### Recordatorios - Email
- [ ] Email se envía en fecha/hora correcta
- [ ] Contenido es correcto
- [ ] Formato HTML funciona
- [ ] Recordatorio para eventos funciona
- [ ] Recordatorio para tareas funciona
- [ ] Marcado como enviado funciona

#### Recordatorios - WhatsApp
- [ ] WhatsApp se envía correctamente
- [ ] Contenido es correcto
- [ ] Fallback a email funciona
- [ ] QR se muestra en configuración
- [ ] Estado de conexión funciona

#### Recordatorios - Cron
- [ ] Cron corre cada minuto
- [ ] Recordatorios pendientes se envían
- [ ] No se duplican
- [ ] Log se muestra en consola

---

### 1️⃣1️⃣ REPORTES

#### Honorarios Pendientes
- [ ] Reporte carga
- [ ] Filtros funcionan
- [ ] Totales son correctos
- [ ] Saldos se calculan bien
- [ ] Valores JUS son correctos

#### Gastos Pendientes
- [ ] Reporte carga
- [ ] Filtros funcionan
- [ ] Totales son correctos
- [ ] Saldos se calculan

#### Vencimientos
- [ ] Reporte carga
- [ ] Filtro por mes funciona
- [ ] Cuotas vencidas se muestran
- [ ] Montos son correctos

#### Ingresos
- [ ] Reporte carga
- [ ] Gráfico se muestra
- [ ] Datos son correctos
- [ ] Exportar funciona

---

### 1️⃣2️⃣ DASHBOARD

#### KPIs
- [ ] Casos activos se muestra
- [ ] Tareas pendientes se muestra
- [ ] Tareas vencidas se muestra
- [ ] Honorarios del mes se muestra
- [ ] Gastos del mes se muestra
- [ ] Cálculos son correctos

#### Widgets
- [ ] Tareas próximas se muestran
- [ ] Eventos próximos se muestran
- [ ] Filtros funcionan
- [ ] Refrescar funciona

---

### 1️⃣3️⃣ CONFIGURACIÓN

#### Parámetros
- [ ] Listar parámetros funciona
- [ ] Crear parámetro funciona
- [ ] Editar parámetro funciona
- [ ] Orden funciona
- [ ] Jerarquía funciona

#### Usuarios
- [ ] Listar usuarios funciona
- [ ] Crear usuario funciona
- [ ] Editar usuario funciona
- [ ] Asignar roles funciona
- [ ] Cambiar permisos funciona

#### Valor JUS
- [ ] Crear valor JUS funciona
- [ ] Listar valores funciona
- [ ] Validación de fecha funciona
- [ ] Activar/desactivar funciona

#### WhatsApp
- [ ] Estado de conexión se muestra
- [ ] QR se muestra
- [ ] Reconexión automática funciona
- [ ] Logs se muestran

---

### 1️⃣4️⃣ NAVEGACIÓN Y UX

#### Navegación
- [ ] Navegación entre módulos funciona
- [ ] Breadcrumbs funcionan
- [ ] Volver funciona
- [ ] Tabs se persisten
- [ ] Estado de formularios se persiste

#### Responsive
- [ ] Funciona en desktop
- [ ] Funciona en tablet
- [ ] Funciona en móvil
- [ ] Menú se adapta
- [ ] Formularios se adaptan

#### Performance
- [ ] Páginas cargan rápido (<2s)
- [ ] Búsquedas son rápidas
- [ ] Filtros no laggean
- [ ] Paginación fluida
- [ ] No hay memory leaks

#### Notificaciones
- [ ] Mensajes de éxito se muestran
- [ ] Mensajes de error se muestran
- [ ] Notificaciones se cierran
- [ ] No se acumulan infinitamente

---

### 1️⃣5️⃣ ERRORES Y EDGES

#### Errores
- [ ] Error 404 se muestra
- [ ] Error 500 se maneja
- [ ] Errores de validación se muestran
- [ ] Errores de red se muestran
- [ ] Mensajes son claros

#### Casos Límite
- [ ] Cliente sin casos funciona
- [ ] Caso sin cliente (debería fallar)
- [ ] Evento sin fecha falla correctamente
- [ ] Honorario sin monto falla correctamente
- [ ] Archivo muy grande falla correctamente
- [ ] Credenciales Drive inválidas se manejan

#### Concurrencia
- [ ] Múltiples usuarios simultáneos
- [ ] Editar mismo registro
- [ ] No se pierden datos

---

## 🐛 Errores Encontrados

### Críticos (Bloquean funcionamiento)
1. 
2. 
3. 

### Importantes (Afectan usabilidad)
1. 
2. 
3. 

### Menores (Mejoras)
1. 
2. 
3. 

---

## 📊 Resultado Final

- [ ] Todos los tests pasaron
- [ ] Errores críticos: 0
- [ ] Errores importantes: ____
- [ ] Errores menores: ____

**Estado General:** [ ] ✅ Aprobado | [ ] ⚠️ Aprobado con observaciones | [ ] ❌ No aprobado

---

## 💾 Notas de Testing

**Fecha de inicio:** ___________  
**Fecha de fin:** ___________  
**Tester:** ___________  
**Ambiente:** Desarrollo / Producción

**Observaciones generales:**
_________________________________________________


