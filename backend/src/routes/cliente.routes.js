// src/routes/cliente.routes.js
import { Router } from 'express';
import * as ctrl from '../controllers/cliente.controller.js';
import * as notaCtrl from '../controllers/cliente-nota.controller.js';
import * as historialCtrl from '../controllers/cliente-historial.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePermiso } from '../middlewares/rbac.js';
import { validate } from '../middlewares/validate.js';
import { crearClienteSchema, actualizarClienteSchema } from '../validators/cliente.schema.js';

const r = Router();
r.use(requireAuth);

// Clientes
r.get('/', requirePermiso('CLIENTES','ver'), ctrl.listar);
r.get('/:id/detalle', requirePermiso('CLIENTES','ver'), ctrl.detalleCliente);
r.get('/:id', requirePermiso('CLIENTES','ver'), ctrl.obtener);
r.post('/', requirePermiso('CLIENTES','crear'), validate(crearClienteSchema), ctrl.crear);
r.put('/:id', requirePermiso('CLIENTES','editar'), validate(actualizarClienteSchema), ctrl.actualizar);
r.delete('/:id', requirePermiso('CLIENTES','eliminar'), ctrl.borrar);
// Contactos del cliente
r.post('/:id/contactos', requirePermiso('CLIENTES','editar'), ctrl.crearContacto);
r.put('/:id/contactos/:contactoId', requirePermiso('CLIENTES','editar'), ctrl.actualizarContacto);
r.delete('/:id/contactos/:contactoId', requirePermiso('CLIENTES','editar'), ctrl.eliminarContacto);

// Notas del cliente
r.get('/:clienteId/notas', requirePermiso('CLIENTES','ver'), notaCtrl.listar);
r.post('/:clienteId/notas', requirePermiso('CLIENTES','editar'), notaCtrl.crear);
r.put('/:clienteId/notas/:notaId', requirePermiso('CLIENTES','editar'), notaCtrl.actualizar);
r.delete('/:clienteId/notas/:notaId', requirePermiso('CLIENTES','editar'), notaCtrl.eliminar);

// Historial del cliente
r.get('/:clienteId/historial', requirePermiso('CLIENTES','ver'), historialCtrl.obtener);

export default r;
