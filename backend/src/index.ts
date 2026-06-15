import "dotenv/config";
import express from "express";
import cors from "cors";
import { moderateRouter } from "./routes/moderate.js";
import { queueRouter } from "./routes/queue.js";
import { policiesRouter } from "./routes/policies.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health + key-presence check (the UI uses this to warn if no key is set).
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: process.env.MODERATION_MODEL || "claude-opus-4-8",
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    thinking: (process.env.MODERATION_THINKING ?? "true") !== "false",
  });
});

app.use("/api", moderateRouter);
app.use("/api", queueRouter);
app.use("/api", policiesRouter);

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`Moderation API listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "⚠  ANTHROPIC_API_KEY is not set — classification calls will fail. Copy .env.example to .env and add your key."
    );
  }
});
