import { config as loadDotenv } from "dotenv";

// dotenv v17 prints an injection banner to stdout by default; stdout is
// reserved for MCP JSON-RPC framing, so load quietly.
loadDotenv({ quiet: true });
