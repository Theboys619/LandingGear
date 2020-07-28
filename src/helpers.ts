import { contentType } from "https://deno.land/x/media_types@v2.4.2/mod.ts";
import * as Path from "https://deno.land/std/path/mod.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

export async function readFileRecursive(path: string): Promise<Array<string>> {
  let files: Array<string> = [];
  for await (const dirEntry of Deno.readDir(path)) {
    if (dirEntry.isDirectory) {
      let recurseData = await readFileRecursive(Path.join(path, dirEntry.name));
      files = [...files, ...recurseData];
    } else {
      files.push(Path.join(path, dirEntry.name));
    }
  }
  return files;
}

export function isHTML(data: any): boolean {
  let regex = /<.+>[\s\S\w]*<\/?.+>/;

  if (typeof data !== "string")
    data = decoder.decode(data);
  
    return regex.test(data);
}

export function convertExt(ext: string): string | void {
  let datatype;
  if (ext === "txt") {
    datatype = contentType("text/plain")
  } else if (ext === "json") {
    datatype = contentType("application/json");
  } else {
    datatype = contentType(ext);
  }

  if (datatype) {
    return datatype;
  }
}

export async function exists(filename: string): Promise<boolean> {
  try {
    await Deno.stat(Path.fromFileUrl(new URL(filename, import.meta.url).href));

    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
}

export function getRealpath(path: string | undefined, pathname: string) {
  if (path == pathname) return true;
  if (typeof path !== "string") return false;

  path = path.replace(/^\/|\/$/g, "");
  path = "/" + path;

  let fixedPath = path.replace(/\/?\:[a-zA-Z0-9\!@\#\$%\^\*\(\)]+/g, "");
  let pathLength = path.split("/").length-1;

  if (path.includes("/:") && pathname.includes(fixedPath) && pathname.split("/").length-1 == pathLength) {
    return path;
  } else {
    return false;
  }
}

export {
  contentType,
  Path
}