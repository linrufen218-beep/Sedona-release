import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // AI Proxy Route to bypass CORS in preview environment
  app.post("/api/ai-proxy", async (req, res) => {
    try {
      const { url, method, headers, body } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "Missing URL for proxy" });
      }

      console.log(`[AI Proxy] ${method || 'POST'} -> ${url}`);

      const response = await axios({
        url,
        method: method || 'POST',
        headers: {
          ...headers,
          // Remove host header to avoid conflicts
          'host': undefined,
          'referer': undefined,
          'origin': undefined
        },
        data: body,
        // Set timeout to 120 seconds
        timeout: 120000,
      });

      res.status(response.status).json(response.data);
    } catch (error: any) {
      console.error("[AI Proxy Error]", error.message);
      
      const status = error.response?.status || 500;
      const data = error.response?.data || { error: error.message };
      
      res.status(status).json(data);
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`AI Proxy available at http://localhost:${PORT}/api/ai-proxy`);
  });
}

startServer();
