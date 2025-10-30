export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const payload = {
    error: err.name || 'Error',
    message: err.publicMessage || err.message || 'Ocurrió un error',
    details: err.details
  };
  req.log?.error({ err });
  res.status(status).json(payload);
}
