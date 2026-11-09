const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const publicDirectory = path.join(__dirname, "public");

app.disable("x-powered-by");
app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", service: "raumwerk-interior-studio" });
});
app.use(express.static(publicDirectory, { extensions: ["html"] }));
app.get("*", (_request, response) => {
  response.sendFile(path.join(publicDirectory, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Raumwerk läuft auf Port ${port}`);
});
