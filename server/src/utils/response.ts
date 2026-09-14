import { Response } from 'express';

/** Unified success envelope: { code, message, data }. */
export function sendSuccess<T>(res: Response, data: T, message = 'Success', code = 200): Response {
  return res.status(code).json({ code, message, data });
}

/** Wrap an async controller so thrown errors reach the error middleware. */
import { NextFunction, Request, RequestHandler } from 'express';

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
