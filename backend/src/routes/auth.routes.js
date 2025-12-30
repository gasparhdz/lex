import { Router } from 'express';
import { requireAuth } from "../middlewares/auth.js";
import * as ctrl from '../controllers/auth.controller.js';

const r = Router();

r.post('/login', ctrl.login);
r.get("/me", requireAuth, ctrl.me);

export default r;
