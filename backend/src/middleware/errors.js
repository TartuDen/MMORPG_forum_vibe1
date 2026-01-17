export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.details || err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      error: 'Resource not found',
      code: 'NOT_FOUND'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      code: 'FILE_TOO_LARGE'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    message: err.message || 'Internal server error',
    code: err.code || 'SERVER_ERROR'
  });
};

export const notFound = (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND'
  });
};
