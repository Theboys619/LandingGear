# Landing Gear

Landing Gear is a typescript module for Deno. It is also heavily ~~inspired~~ by ExpressJS for node or reacreated.
Landing Gear is useful for creating REST Api's or Web Servers

### Installation and Setup

```ts
import landingGear from "HOST/mod.ts";

const app = landingGear();

app.use(landingGear.json()); // The app can use middleware before sending response

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(8080, () => { // First param is port and second is the callback
  console.log("Server Running");
});
```

### Routers

```ts
import landingGear from "HOST/mod.ts"; // Import module

const router = landingGear.Router(); // Access the Router function which creates a new Router

router.use(landingGear.cors()); // Routers can also have middleware

router.get("/test", (req, res) => { // Similar to app, path and callback
  res.send("Hello World!"); // Send 'Hello World!' as a response
});

export default router; // Export router as default or export it with other exports
```

### Workers

Workers are useful for multi-threading single requests

**index.ts**
```ts
import landingGear from "HOST/mod.ts";

const app = landingGear();

app.createWorker("GET", "/", "./worker.ts"); // Create a worker for handling 'GET' requests on path '/'
// Params: (METHOD, PATH, FILEPATH)

app.listen(8080, () => {
  console.log("Server Running");
});
```

**Worker.ts**
```ts
import { WorkerResponse } from "HOST/mod.ts"; // Import the WorkerResponse class

const response = new WorkerResponse(self); // Pass in self to init worker

response.addCallback(() => { // Add a callback for when requests are made
  response.sendFile("hello.txt"); // Send a file as response still similar
});
```