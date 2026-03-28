import { ValidationError } from "./errors.js";

export function parseIdParam(idParam: string, label = "ID"): number {
  if (!/^\d+$/.test(idParam)) {
    throw new ValidationError(`Invalid ${label}`);
  }
  const id = Number(idParam);
  if (!Number.isInteger(id) || id < 1) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return id;
}
