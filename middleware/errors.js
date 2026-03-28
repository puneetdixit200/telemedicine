function notFoundHandler(req, res) {
  if (req.isApi) return res.status(404).json({ error: 'Not found' });
  return res.status(404).send('Not found');
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || 500;
  const message = err.message || 'Unexpected error';

  if (req.isApi) return res.status(status).json({ error: message });

  if (status >= 500) {
    return res.status(status).send('Unexpected error');
  }

  return res.status(status).send(message);
}

module.exports = { notFoundHandler, errorHandler };
