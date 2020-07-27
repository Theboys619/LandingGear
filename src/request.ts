import { contentType, Path } from "./helpers.ts";
import { Server, ServerRequest } from "https://deno.land/std/http/server.ts";

import { Response } from "./response.ts"
import { LGMiddleware, RequestCallback, LGMiddlewareErr, isInstanceOfMiddleware, isInstanceOfMiddlewareErr } from "./middleware.ts"

function getErrorHTML(req: Request) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error</title>
      </head>
      <body>
        <pre>Cannot ${req.method.toUpperCase()} ${req.pathname}</pre>
      </body>
    </html>
  `;
}

function getProtocol(data: string): string {
  return data.includes("https") ? "https" : "http";
}

export interface IListener {
  type: "request" | "middleware",
  path?: string,
  method?: "GET" | "POST" | "OPTIONS",
  cb?: RequestCallback,
  middleware?: LGMiddleware | LGMiddlewareErr,
}

export class HTTPRequest {
  #server: Server;
  req: Request;
  res: Response;
  headers: Headers;
  error: any;
  method: string;
  headersSent: boolean;

  constructor (server: Server, req: ServerRequest) {
    this.#server = server;

    this.headers = (req.headers) ? new Headers(req.headers) : new Headers();
    this.method = req.method ?? "GET";

    this.headersSent = false;

    this.req = new Request(req, this.headers);
    this.res = new Response(req, this.headers);
  }

  getRealpath(path: string | undefined) { // "/test/:test"
    if (path == this.req.pathname) return true;
    if (typeof path !== "string") return false;
    let params = this.req.constructParams(path);

    path = path.replace(/^\/|\/$/g, "");
    path = "/" + path;

    let fixedPath = path.replace(/\/?\:[a-zA-Z0-9\!@\#\$%\^\*\(\)]+/g, "");
    let pathLength = path.split("/").length-1;

    if (path.includes("/:") && this.req.pathname.includes(fixedPath) && this.req.pathname.split("/").length-1 == pathLength) {
      return fixedPath;
    } else {
      return false;
    }
  }

  async handleMiddleware(middleware: LGMiddleware | LGMiddlewareErr, next: Function): Promise<any> {
    if (isInstanceOfMiddlewareErr(middleware)) {
      return middleware.apply(null, [this.error, this.req, this.res, next]);
    } else {
      return middleware.apply(null, [this.req, this.res, next]);
    }
  }

  handleRequest(listeners: Array<IListener>) {
    let i = -1;
    let listener = listeners[0];

    let self = this;

    async function next() {
      let nextCalled = false;
      i++;
      listener = listeners[i];

      if (i >= listeners.length || !listener) {
        if (!self.headersSent)
          return self.res.send(getErrorHTML(self.req), 404);
        else
          return;
      }



      if (!self.headersSent && listener.type == "request" && listener.method == self.method && self.getRealpath(listener.path)) {

        if (listener.middleware) {
          let called = await self.handleMiddleware(listener.middleware, () => {});
          nextCalled = true;
        }

        if (listener.cb) {
          listener.cb.apply(null, [self.req, self.res]);
        }
        self.headersSent = true;
        if (!listener.middleware) {next(); nextCalled = true;}

      } else if (listener.type == "middleware") {

        if (listener.middleware) {
          self.handleMiddleware(listener.middleware, next);
          nextCalled = true;
        }

      } else if (!self.headersSent && !nextCalled) {
        next();
      }
    }

    if (listeners.length > 0) {
      next();
    } else {
      this.res.send(getErrorHTML(this.req), 404);
    }
  }

  getRequest() {
    return this.req;
  }

  getResponse() {
    return this.res;
  }
}

export class Request {
  req: ServerRequest;
  headers: Headers;
  method: string;

  body: {[x: string]: any};
  params: { [x: string]: any };

  pathname: string;
  url: string;
  host: string;
  protocol: string;
  [x: string]: any;

  constructor (req: ServerRequest, headers?: Headers) {
    this.req = req;

    this.pathname = req.url;
    this.protocol = getProtocol(req.proto);
    this.host = req.headers.get("host") ?? "";
    this.url = `${this.protocol}://${this.host}${this.pathname}`;

    this.headers = (headers) ? headers : (req.headers) ? new Headers(req.headers) : new Headers();
    this.method = req.method ?? "GET";

    this.body = {};
    this.params = {};
  }

  getBody = (): Promise<any> | Deno.Reader =>  {
    return Deno.readAll(this.req.body)
  }

  constructParams(path: string): { [x: string]: any } {
    if (path.startsWith("/")) path = path.substr(1);
    if (path.endsWith("/")) path = path.slice(0, -1)

    let paths = path.split("/");
    let fullpaths = this.pathname.split("/");
    let index = 0;

    fullpaths.splice(0, 1);

    for (let pathname of paths) {
      if (pathname.startsWith(":")) {
        pathname = pathname.substr(1);

        this.params[pathname] = fullpaths[index];
      }
      index++;
    }

    return this.params;
  }
}