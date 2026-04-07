function apiErrorPayload(req, message, code = 'REQUEST_ERROR') {
  return {
    error: message,
    code,
    requestId: req?.requestId || null,
    timestamp: new Date().toISOString()
  };
}

function sendApiError(req, res, status, message, code = 'REQUEST_ERROR') {
  return res.status(status).json(apiErrorPayload(req, message, code));
}

module.exports = { apiErrorPayload, sendApiError };
