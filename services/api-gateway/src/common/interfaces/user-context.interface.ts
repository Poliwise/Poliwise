import 'express';

declare module 'express' {
  interface Request {
    user?: import('./jwt-payload.interface').IUserContext;
    traceId?: string;
  }
}
