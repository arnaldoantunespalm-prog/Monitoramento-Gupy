import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Gupy API Proxy
  app.get("/api/jobs", async (req, res) => {
    try {
      const { searchTerm, offset = 0, workplaceType = "remote", state = "" } = req.query;
      
      const fetchWithHeaders = async (useComplexHeaders: boolean) => {
        const gupyUrl = new URL("https://employability-portal.gupy.io/api/v1/jobs");
        gupyUrl.searchParams.append("limit", "100");
        gupyUrl.searchParams.append("offset", String(offset));
        if (searchTerm) gupyUrl.searchParams.append("jobName", String(searchTerm));
        if (workplaceType) gupyUrl.searchParams.append("workplaceType", String(workplaceType));
        if (state && state !== "Todos") gupyUrl.searchParams.append("state", String(state));

        const headers: Record<string, string> = useComplexHeaders ? {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://portal.gupy.io/',
          'Origin': 'https://portal.gupy.io',
        } : {
          'User-Agent': 'Mozilla/5.0'
        };

        return fetch(gupyUrl.toString(), { headers });
      };

      // Try complex headers first
      let response = await fetchWithHeaders(true);

      // If blocked (403) or other error, try simple headers
      if (!response.ok && (response.status === 403 || response.status === 401)) {
        console.warn(`Gupy API blocked with complex headers (${response.status}). Trying simple headers...`);
        response = await fetchWithHeaders(false);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Sem detalhes");
        console.error(`Gupy API Error: ${response.status} - ${errorText.substring(0, 200)}`);
        
        if (response.status === 403) {
          throw new Error("Acesso negado pela Gupy (Cloudflare/Bot Protection). Tente novamente em instantes.");
        }
        throw new Error(`Gupy API retornou erro ${response.status}`);
      }

      const textData = await response.text();
      let data;
      try {
        data = JSON.parse(textData);
      } catch (e) {
        console.error("Failed to parse Gupy response as JSON. Response starts with:", textData.substring(0, 100));
        throw new Error("A API da Gupy retornou um formato inválido (possível bloqueio).");
      }

      res.json(data);
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: error.message });
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
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
