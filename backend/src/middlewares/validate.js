export const validate = (schema, source = 'body') => (req, res, next) => {
  const data = source === 'query' ? req.query : req.body;
  
  // Detectar si es Zod o Joi
  const isZod = typeof schema.safeParse === 'function';
  
  if (isZod) {
    // Usar Zod
    const result = schema.safeParse(data);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      });
    }
    
    if (source === 'body') {
      req.body = result.data;
    }
  } else {
    // Usar Joi
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: error.details.map((detail) => ({
          path: detail.path,
          message: detail.message,
        })),
      });
    }

    if (source === 'body') {
      req.body = value;
    }
  }
  
  next();
};
