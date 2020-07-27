import { contentType, Path, readFileRecursive } from "./helpers.ts";
import { serve, Server, ServerRequest } from "https://deno.land/std/http/server.ts";

import { HTTPRequest, Request, IListener } from "./request.ts";
import { RequestCallback, LGError, LGMiddleware, LGMiddlewareErr, isInstanceOfMiddleware, isInstanceOfMiddlewareErr, isInstanceOfRequestCallback } from "./middleware.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

export interface LGOptions {}
export type MethodTypes = "GET" | "POST" | "OPTIONS";

export class App {
  #options: LGOptions;
  #listeners: Array<IListener>;
  #server: Server | undefined;

  constructor (options?: LGOptions) {
    this.#options = options ?? {};

    this.#listeners = [];
  }

  #monitorRequests = async () => {
    if (!this.#server) return;
    for await (const servreq of this.#server) {
      let httpreq = new HTTPRequest(this.#server, servreq);
      httpreq.handleRequest(this.#listeners);
    }
  }

  listen(port: number, cb?: Function) {
    this.#server = serve({ port });
    if (typeof cb == "function") {
      cb();
    }

    this.#monitorRequests();

    return this.#server;
  }

  use(middleware: LGMiddleware): void;
  use(middleware: LGMiddleware): void;
  use(middleware: Router): void;
  use(middleware: LGMiddleware | LGMiddlewareErr | Router): void {
    if (middleware instanceof Router) {
      this.#listeners = this.#listeners.concat(middleware.getListeners());
    } else {
      this.#listeners.push({
        type: "middleware",
        middleware
      }); 
    }
  }

  #createListener = (method: MethodTypes, path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): void => {
    if (typeof cb == "function" && (isInstanceOfMiddleware(middleware) || isInstanceOfMiddlewareErr(middleware))) {
      this.#listeners.push({
        type: "request",
        method,
        path,
        middleware,
        cb
      });
    } else if (isInstanceOfRequestCallback(middleware)) {
      this.#listeners.push({
        type: "request",
        method,
        path,
        cb: middleware
      });
    }
  }
  
  get(path: string, middleware: RequestCallback, cb?: RequestCallback): void;
  get(path: string, middleware: LGMiddlewareErr, cb?: RequestCallback): void;
  get(path: string, middleware: LGMiddleware, cb?: RequestCallback): void;
  get(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): void {
    this.#createListener("GET", path, middleware, cb);
  }

  post(path: string, middleware: RequestCallback, cb?: RequestCallback): void;
  post(path: string, middleware: LGMiddlewareErr, cb?: RequestCallback): void;
  post(path: string, middleware: LGMiddleware, cb?: RequestCallback): void;
  post(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): void {
    this.#createListener("POST", path, middleware, cb);
  }

  options(path: string, middleware: RequestCallback, cb?: RequestCallback): void;
  options(path: string, middleware: LGMiddlewareErr, cb?: RequestCallback): void;
  options(path: string, middleware: LGMiddleware, cb?: RequestCallback): void;
  options(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): void {
    this.#createListener("OPTIONS", path, middleware, cb);
  }
}

export class Router {
  #listeners: Array<IListener>;

  constructor (options?: LGOptions) {
    this.#listeners = [];
  }

  #createListener = (method: "GET" | "POST" | "OPTIONS", path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): void => {
    if (typeof cb == "function" && (isInstanceOfMiddleware(middleware) || isInstanceOfMiddlewareErr(middleware))) {
      this.#listeners.push({
        type: "request",
        method,
        path,
        middleware,
        cb
      });
    } else if (isInstanceOfRequestCallback(middleware)) {
      this.#listeners.push({
        type: "request",
        method,
        path,
        cb: middleware
      });
    }
  }
  
  get(path: string, middleware: RequestCallback, cb?: RequestCallback): void;
  get(path: string, middleware: LGMiddlewareErr, cb?: RequestCallback): void;
  get(path: string, middleware: LGMiddleware, cb?: RequestCallback): void;
  get(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): void {
    this.#createListener("GET", path, middleware, cb);
  }

  post(path: string, middleware: RequestCallback, cb?: RequestCallback): void;
  post(path: string, middleware: LGMiddlewareErr, cb?: RequestCallback): void;
  post(path: string, middleware: LGMiddleware, cb?: RequestCallback): void;
  post(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): void {
    this.#createListener("POST", path, middleware, cb);
  }

  options(path: string, middleware: RequestCallback, cb?: RequestCallback): void;
  options(path: string, middleware: LGMiddlewareErr, cb?: RequestCallback): void;
  options(path: string, middleware: LGMiddleware, cb?: RequestCallback): void;
  options(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): void {
    this.#createListener("OPTIONS", path, middleware, cb);
  }

  getListeners() {
    return this.#listeners;
  }
}

export default function landingGear(options?: LGOptions): App {
  landingGear.app = new App(options);

  return landingGear.app;
}

landingGear.app = new App();

landingGear.Router = (options?: LGOptions) => {
  return new Router(options);
}

// Defaults //

landingGear.static = function (path: string, urlPath: string = "/"): LGMiddleware {
  (async () => {
    let files = await readFileRecursive(path);
    
    for (let filepath of files) {
      let data = await Deno.readFile(filepath);
      let text = decoder.decode(data);
      let spath: any = [];

      filepath = filepath.replaceAll("\\\\", "/");
      filepath = filepath.replaceAll("\\", "/");

      if (!filepath.startsWith("/")) {
        spath = filepath.split("/");
      } else {
        filepath = filepath.substr(1);
        spath = filepath.split("/");
      }

      if (spath.length == 1) {
        this.app.get(urlPath, (req, res) => {
          res.sendFile(filepath);
        });
      } else {
        spath.splice(0, 1);
        spath = Path.join(urlPath, spath.join("/"));

        spath = spath.replaceAll("\\\\", "/");
        spath = spath.replaceAll("\\", "/");

        this.app.get(spath, (req, res) => {
          res.sendFile(filepath);
        });
      }
    }
  })();

  return async (req, res, next) => {
    next();
  }
}

landingGear.cors = function (): LGMiddleware {
  return async (req, res, next) => {
    req.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Origin", "*");

    next();
  }
}

landingGear.json = function (): LGMiddleware {
  return async (req, res, next) => {
    let body: any = await req.getBody();
    let decoded = decoder.decode(body);

    try {
      body = JSON.parse(decoded);
      req.body = body;
    } catch (err) {
      req.body = {};
    }

    next();
  }
}