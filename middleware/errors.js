function notFoundHandler(req, res) {
  res.status(404);
  if (req.accepts('html')) return res.render('dashboard', { user: req.user || null, message: 'Not found' });
  return res.json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.error(err);
  const status = err.status || 500;
  res.status(status);
  if (req.accepts('html')) {
    return res.render('dashboard', {
      user: req.user || null,
      message: status === 500 ? 'Unexpected error' : err.message
    });
  }
  return res.json({ error: err.message || 'Unexpected error' });
}

module.exports = { notFoundHandler, errorHandler };
