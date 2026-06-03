import handleValidationError from "../errors/handleValidationError.js";
import handleDuplicateError from "../errors/handleDuplicateError.js";
import HandleCastError from "../errors/handleCastError.js";

export const globalErrorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errorSources = [{ path: "", message }];

  if (err.name === "ValidationError") {
    ({ statusCode, message, errorSources } = handleValidationError(err));
  } else if (err.code === 11000) {
    ({ statusCode, message, errorSources } = handleDuplicateError(err));
  } else if (err.name === "CastError") {
    ({ statusCode, message, errorSources } = HandleCastError(err));
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
