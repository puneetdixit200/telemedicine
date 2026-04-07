const API_PATH_RE = /^\/api(?:\/v\d+)?(?:\/|$)/i;

function isApiPath(req) {
  const originalUrl = String(req.originalUrl || '');
  return API_PATH_RE.test(originalUrl);
}

function enableApiMode(req, res, next) {
  if (!isApiPath(req)) return next();

  req.isApi = true;

  res.render = (view, locals = {}) => {
    if (typeof locals === 'function') {
      return res.json({ ok: res.statusCode < 400, view });
    }
    return res.json({ ok: res.statusCode < 400, view, ...locals });
  };

  res.redirect = (statusOrUrl, maybeUrl) => {
    let status = 302;
    let redirectTo = statusOrUrl;

    if (typeof statusOrUrl === 'number') {
      status = statusOrUrl;
      redirectTo = maybeUrl;
    }

    const responseStatus = status >= 400 ? status : 200;
    return res.status(responseStatus).json({ ok: status < 400, redirectTo, redirectStatus: status });
  };

  return next();
}

module.exports = { enableApiMode, isApiPath };