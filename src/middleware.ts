import { contentType, Path } from "./helpers.ts";
import { Server, ServerRequest } from "https://deno.land/std/http/server.ts";

import { Request } from "./request.ts";
import { Response } from "./response.ts";

export class LGError extends Error {
  public message: string;
  [x: string]: any;

  constructor (message: string) {
    super(`Error Handling request: ${message}`);
    this.message = message;
  }
}

export type RequestCallback = (req: Request, res: Response) => void;

export type LGMiddleware = (req: Request, res: Response, next: Function) => void;
export type LGMiddlewareErr = (err: LGError, req: Request, res: Response, next: Function) => void;

export function isInstanceOfMiddleware(object: any): object is LGMiddleware {
  return object.length == 3;
}

export function isInstanceOfMiddlewareErr(object: any): object is LGMiddlewareErr {
  return object.length == 4;
}

export function isInstanceOfRequestCallback(object: any): object is RequestCallback {
  return true;
}