const express = require("express");
const cors = require("cors");
const routes = require("./routes/api");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", routes);

app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

module.exports = app;
