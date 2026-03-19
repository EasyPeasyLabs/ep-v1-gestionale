import express from "express";
import { createServer as createViteServer } from "vite";
import fetch from "node-fetch";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // API Proxy for Slots (Punta alla V2 in produzione)
  app.get("/api/slots", async (req, res) => {
    try {
      const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY || "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
      
      const response = await fetch("https://getpublicslotsv2-7wnvtld3xq-ew.a.run.app", {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${BRIDGE_SECURE_KEY}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        const cleanError = errorText.includes('<html') ? 'HTML Error Page (Unauthorized/Forbidden)' : errorText;
        console.log(`[API Proxy] External API returned ${response.status}:`, cleanError);
        return res.status(response.status).json({ 
          success: false, 
          error: `External API error: ${response.status}`,
          details: cleanError.substring(0, 200) 
        });
      }

      const data = await response.json();
      return res.json(data);
    } catch (error) {
      console.warn("Warning proxying slots:", error);
      res.status(500).json({ success: false, error: "Failed to fetch slots from external API", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // API Proxy for Lead Submission (Punta alla V2 in produzione)
  app.post("/api/receive-lead", async (req, res) => {
    try {
      const BRIDGE_SECURE_KEY = process.env.BRIDGE_SECURE_KEY || "EP_V1_BRIDGE_SECURE_KEY_8842_XY";
      
      const response = await fetch("https://receiveleadv2-7wnvtld3xq-ew.a.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${BRIDGE_SECURE_KEY}`
        },
        body: JSON.stringify(req.body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const cleanError = errorText.includes('<html') ? 'Unauthorized or Forbidden (Check IAM or API Key)' : errorText;
        console.log(`[API Proxy] External API returned ${response.status}: ${cleanError}`);
        return res.status(response.status).json({ success: false, error: "External API failed", details: cleanError });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.warn("Warning proxying lead submission:", error);
      res.status(500).json({ success: false, error: "Failed to submit lead to external API", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve static files from dist
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// ------------------------------

startServer();
