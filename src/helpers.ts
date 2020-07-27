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

export {
  contentType,
  Path
}