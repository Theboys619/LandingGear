# Landing Gear

Landing Gear is a typescript module for Deno. It is also heavily ~~inspired~~ by ExpressJS for node or reacreated.
Landing Gear is useful for creating REST Api's or Web Servers

### Installation and Setup

```ts
import landingGear from "HOST/mod.ts";

const app = landingGear();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(8080, () => {
  console.log("Server Running");
});
```