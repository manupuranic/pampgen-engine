const express = require("express");
const cors = require("cors");
const app = express();
const pamphletRoutes = require("./routes/pamphlet");
const path = require("path");

app.use(cors());
app.use(express.json());
app.use("/output", express.static(path.join(__dirname, "output")));
app.use("/api/pamphlet", pamphletRoutes);

app.listen(3001, () => console.log("Server running on port 3001"));
