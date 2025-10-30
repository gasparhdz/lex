export const validate = (schema, source = 'body') => (req, res, next) => {
  const data = source === 'query' ? req.query : req.body;
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

  // No intentar modificar req.query (read-only), solo validar
  if (source === 'body') {
    req.body = value;
  }
  
  next();
};
