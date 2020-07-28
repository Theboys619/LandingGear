import { contentType, Path, isHTML, convertExt } from "./helpers.ts";
import { Server, ServerRequest } from "https://deno.land/std/http/server.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

const BODYTYPES = ["string", "number", "bigint", "boolean", "object"];

export class Response {
  req: ServerRequest;
  headers: Headers;
  method: string;
  status: number;
  [x: string]: any;

  constructor (req: ServerRequest, headers?: Headers) {
    this.req = req;
    
    this.headers = (headers) ? headers : (req.headers) ? new Headers(req.headers) : new Headers();
    this.method = req.method ?? "GET";
    
    this.status = 404;
  }

  setContentType(header: string, type: any) {
    let typestring = contentType(type);
    if (typestring && !this.headers.has(header)) {
      this.headers.append(header, typestring);
      this.req.headers = this.headers;
    }
  }
  
  setHeader(header: string, value: any) {
    this.headers.set(header, value);
  }

  sendFile(path: string, options?: { root: string }) {
    if (options && options.root) path = Path.join(options.root, path);
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
    } else if (BODYTYPES.includes(typeof data)) {
      data = encoder.encode(data);
      if (!type)
        type = (isHTML(data)) ? "html" : "text/plain";
    }

    this.setContentType("Content-Type", type);

    this.req.respond({ body: data, headers: this.headers, status: this.status });
    return true;
  }

  setStatus(status: number): Response {
    this.status = status;
    return this;
  }
}