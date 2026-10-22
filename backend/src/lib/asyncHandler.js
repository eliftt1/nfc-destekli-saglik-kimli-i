// Express 4'te async hataları errorHandler'a iletir.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
