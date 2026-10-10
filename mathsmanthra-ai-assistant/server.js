require("dotenv").config();
const aiRoutes = require("./routes/ai.route.js");

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", aiRoutes);

app.get("/", (req, res) => {
  res.send("MathsManthra AI Mentor Server Running");
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});