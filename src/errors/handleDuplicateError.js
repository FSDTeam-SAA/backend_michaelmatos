const handleDuplicateError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  return {
    statusCode: 400,
    message: `Duplicate value for field: ${field}`,
    errorSources: [{ path: field, message: err.message }],
  };
};
export default handleDuplicateError;
