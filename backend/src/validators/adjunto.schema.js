// src/validators/adjunto.schema.js
import Joi from 'joi';

export const vincularCarpetaClienteSchema = Joi.object({
  driveFolderId: Joi.string().required(),
});

export const vincularCarpetaCasoSchema = Joi.object({
  driveFolderId: Joi.string().required(),
  numeroDrive: Joi.number().integer().min(1).optional(),
});

export const uploadAdjuntoSchema = Joi.object({
  scope: Joi.string().valid('CLIENTE', 'CASO').required(),
  scopeId: Joi.number().integer().required(),
});

export const listarAdjuntosSchema = Joi.object({
  scope: Joi.string().valid('CLIENTE', 'CASO').required(),
  scopeId: Joi.number().integer().required(),
});

export const indexarAdjuntosSchema = Joi.object({
  scope: Joi.string().valid('CLIENTE', 'CASO').required(),
  scopeId: Joi.number().integer().required(),
});

