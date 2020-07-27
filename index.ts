import { Path } from "./src/helpers.ts";

import landingGear from "./src/mod.ts";

const router = landingGear.Router();

const app = landingGear();
const port = 8080;

app.use(landingGear.static("public"));
app.use(landingGear.cors());
app.use(landingGear.json());
app.use(function (req, res, next) {
  res.renderHtml = (file: string, views: string = "./public/views") => {
    if (!file.includes(".html")) file += ".html";

    res.sendFile(Path.join(views, file));
  }

  next();
});

app.get("/", function (req, res) {
  res.renderHtml("index");
});

app.post("/post", function (req, res) {
  console.log("[/post]:", req.body);
  res.send({"test": "test"});
});

app.post("/post/:name", function (req, res) {
  console.log("[/post/:name]:", req.body, req.params);
  res.send({"success": "ful test!"});
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});