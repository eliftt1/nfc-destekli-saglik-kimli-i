export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export const badRequest = (code, message, details) => new AppError(400, code, message, details);
export const unauthorized = (message = 'Oturum açmanız gerekiyor') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Bu işlem için yetkiniz yok') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Kayıt bulunamadı') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code, message) => new AppError(409, code, message);
