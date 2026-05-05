function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || '서버 오류가 발생했습니다.',
    data: null,
  });
}

function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `경로를 찾을 수 없습니다: ${req.originalUrl}`,
    data: null,
  });
}

module.exports = { errorHandler, notFound };
