import { WorkerResponse } from "../src/mod.ts";

let response = new WorkerResponse(self);

response.addCallback(() => {
  response.sendFile("tsconfig.json", {root: "../"}); // response.send({ "test:": "BET!" })
});