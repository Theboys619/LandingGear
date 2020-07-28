import { contentType, Path, readFileRecursive, exists, isHTML, convertExt, getRealpath } from "./helpers.ts";
import { serve, Server, ServerRequest } from "https://deno.land/std/http/server.ts";

import { HTTPRequest, Request, IListener } from "./request.ts";
import { RequestCallback, LGError, LGMiddleware, LGMiddlewareErr, isInstanceOfMiddleware, isInstanceOfMiddlewareErr, isInstanceOfRequestCallback } from "./middleware.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

export interface LGOptions {
  isWorker?: boolean
  listeners?: Array<IListener>
}
export type MethodTypes = "GET" | "POST" | "OPTIONS";

export class App {
  #options: LGOptions;
  #listeners: Array<IListener>;
  #workers: Map<string, Worker>;
  #server: Server | undefined;

  constructor (options?: LGOptions) {
    this.#options = options ?? { isWorker: false };

    this.#listeners = [];
    this.#workers = new Map;
  }

  #monitorRequests = async () => {
    if (!this.#server) return;
    for await (const servreq of this.#server) {
      let httpreq = new HTTPRequest(this.#server, servreq);
      let data = `${httpreq.method}|${httpreq.getRequest().pathname}`;

      if (this.#workers.has(data)) {
        const worker = this.#workers.get(data) as Readonly<Worker>;

        worker.addEventListener("message", (({ data }: MessageEvent) => {
          servreq.respond({
            status: data.status ?? 404,
            headers: new Headers(data?.headers),
            body: data?.body
          });
        }) as EventListener, {
          once: true,
          passive: true,
          capture: true
        });

        worker.postMessage(undefined);
      } else {
        httpreq.handleRequest(this.#listeners);
      }
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

  createWorker(method: string, path: string, workerPath: string) {
    this.#workers.set(`${method}|${path}`, new Worker(
      new URL(workerPath, import.meta.url).href, {
        type: "module",
        deno: true
      }
    ));
  }
  
  get(path: string, cb: RequestCallback): App;
  get(path: string, middleware: LGMiddlewareErr, cb: RequestCallback): App;
  get(path: string, middleware: LGMiddleware, cb: RequestCallback): App;
  get(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): App {
    this.#createListener("GET", path, middleware, cb);
    return this;
  }

  post(path: string, cb: RequestCallback): App;
  post(path: string, middleware: LGMiddlewareErr, cb: RequestCallback): App;
  post(path: string, middleware: LGMiddleware, cb: RequestCallback): App;
  post(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): App {
    this.#createListener("POST", path, middleware, cb);
    return this;
  }

  options(path: string, cb: RequestCallback): App;
  options(path: string, middleware: LGMiddlewareErr, cb: RequestCallback): App;
  options(path: string, middleware: LGMiddleware, cb: RequestCallback): App;
  options(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): App {
    this.#createListener("OPTIONS", path, middleware, cb);
    return this;
  }
}

export class Router {
  #listeners: Array<IListener>;
  #options: LGOptions;
  pathname: string;

  constructor (options?: LGOptions) {
    this.#listeners = options?.listeners ?? [];

    this.#options = options ?? { isWorker: false };
    this.pathname = Path.dirname(Path.fromFileUrl(new URL('.', import.meta.url).href));
  }

  getOptions() {
    return this.#options;
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
  
  get(path: string, cb: RequestCallback): Router;
  get(path: string, middleware: LGMiddlewareErr, cb: RequestCallback): Router;
  get(path: string, middleware: LGMiddleware, cb: RequestCallback): Router;
  get(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): Router {
    this.#createListener("GET", path, middleware, cb);
    return this;
  }

  post(path: string, cb: RequestCallback): Router;
  post(path: string, middleware: LGMiddlewareErr, cb: RequestCallback): Router;
  post(path: string, middleware: LGMiddleware, cb: RequestCallback): Router;
  post(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): Router {
    this.#createListener("POST", path, middleware, cb);
    return this;
  }

  options(path: string, cb: RequestCallback): Router;
  options(path: string, middleware: LGMiddlewareErr, cb: RequestCallback): Router;
  options(path: string, middleware: LGMiddleware, cb: RequestCallback): Router;
  options(path: string, middleware: LGMiddleware | LGMiddlewareErr | RequestCallback, cb?: RequestCallback): Router {
    this.#createListener("OPTIONS", path, middleware, cb);
    return this;
  }

  getListeners() {
    return this.#listeners;
  }
}

export class WorkerResponse {
  worker: any;
  status: number;
  headers: Headers;
  callbacks: Array<Function>;

  pathname: string;
  #fakepath: string;
  
  params: { [x: string]: any };

  constructor (worker: any) {
    this.worker = worker;

    this.status = 404;
    this.headers = new Headers();

    this.callbacks = [];
    this.params = {};
    this.pathname = "";
    this.#fakepath = "";

    worker.addEventListener(
      "message",
      (e: MessageEvent) => {
        for (let callback of this.callbacks) {
          callback();
        }
      }
    );
  }

  addCallback(cb: Function) {
    this.callbacks.push(cb);
  }

  constructParams(): { [x: string]: any } {
    if (this.#fakepath.startsWith("/")) this.#fakepath = this.#fakepath.substr(1);
    if (this.#fakepath.endsWith("/")) this.#fakepath = this.#fakepath.slice(0, -1)

    let paths = this.#fakepath.split("/");
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

  setContentType(header: string, type: any) {
    let typestring = contentType(type);
    if (typestring && !this.headers.has(header)) {
      this.headers.append(header, typestring);
    }
  }
  
  setHeader(header: string, value: any) {
    this.headers.set(header, value);
  }

  sendFile(path: string, options?: { root: string }) {
    if (options && options.root) path = Path.fromFileUrl(new URL(Path.join(options.root, path), import.meta.url).href);
    else path = Path.fromFileUrl(new URL(path, import.meta.url).href);
    let ext = path.split(".")[path.split(".").length-1] ?? "txt";
    let datatype = convertExt(ext);
    
    Deno.readFile(path).then(data => {
      let text = decoder.decode(data);
      
      if (typeof datatype == "string")
        this.send(text, 200, datatype);
      else
        this.send(text, 200);
    });
  }
  
  send(data: any, status?: number, type?: string): boolean {
    if (!status) this.status = 200;
    else this.status = status;
    if (typeof data == "object" || type == "object") {
      data = JSON.stringify(data);
      if (!type)
        type = "application/json";

      this.setHeader("Content-Length", data.toString().length);
    } else if (["string", "number", "bigint", "boolean", "object"].includes(typeof data)) {
      if (!type)
        type = (isHTML(data)) ? "html" : "text/plain";
    }

    this.setContentType("Content-Type", type);

    if (this.worker?.postMessage)
      this.worker.postMessage({ body: data, headers: Array.from(this.headers.entries()), status: this.status });
    return true;
  }
}

export default function landingGear(options?: LGOptions): App {
  landingGear.app = new App(options);
  landingGear.appCreated = true;

  return landingGear.app;
}

landingGear.app = new App();
landingGear.appCreated = false;

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