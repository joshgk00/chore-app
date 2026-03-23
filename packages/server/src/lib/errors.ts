export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(422, "VALIDATION_ERROR", message, fieldErrors);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
    this.name = "ConflictError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
    this.name = "AuthError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}
