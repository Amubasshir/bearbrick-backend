const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const routes = require("./routes/api");

const app = express();

app.use(cors());
app.use(express.json());

// Swagger UI - load swagger file if it exists
try {
  const swaggerFile = require("./config/swagger-output.json");
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));
} catch (error) {
  console.log(
    "Swagger file not found. Run 'npm run swagger-autogen' to generate it."
  );
}

app.use("/api", routes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

module.exports = app;
