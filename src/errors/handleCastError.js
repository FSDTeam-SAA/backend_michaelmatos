const HandleCastError = (err) => ({
  statusCode: 400,
  message: "Invalid ID",
  errorSources: [{ path: err.path, message: err.message }],
});
export default HandleCastError;
