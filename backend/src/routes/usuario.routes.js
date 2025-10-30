import { Router } from 'express';
import * as ctrl from '../controllers/usuario.controller.js';
import * as rolCtrl from '../controllers/rol.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePermiso } from '../middlewares/rbac.js';
import { validate } from '../middlewares/validate.js';
import { crearUsuarioSchema, actualizarUsuarioSchema } from '../validators/usuario.schema.js';

const r = Router();
r.use(requireAuth);

// Usuarios
r.get('/', requirePermiso('USUARIOS', 'ver'), ctrl.listar);
r.get('/roles', requirePermiso('USUARIOS', 'ver'), ctrl.listarRoles);
r.get('/roles/:id', requirePermiso('USUARIOS', 'ver'), rolCtrl.obtener);
r.post('/roles', requirePermiso('USUARIOS', 'crear'), rolCtrl.crear);
r.put('/roles/:id', requirePermiso('USUARIOS', 'editar'), rolCtrl.actualizar);
r.delete('/roles/:id', requirePermiso('USUARIOS', 'eliminar'), rolCtrl.eliminar);

r.get('/:id', requirePermiso('USUARIOS', 'ver'), ctrl.obtener);
r.post('/', requirePermiso('USUARIOS', 'crear'), validate(crearUsuarioSchema), ctrl.crear);
r.put('/:id', requirePermiso('USUARIOS', 'editar'), validate(actualizarUsuarioSchema), ctrl.actualizar);
r.delete('/:id', requirePermiso('USUARIOS', 'eliminar'), ctrl.borrar);

export default r;
