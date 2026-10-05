import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatJobType(type?: string): string {
  if (!type) return "Efetivo";
  const map: Record<string, string> = {
    vacancy_type_effective: "Efetivo",
    vacancy_type_internship: "Estágio",
    vacancy_type_talent_pool: "Banco de Talentos",
    vacancy_type_temporary: "Temporário",
    vacancy_type_apprentice: "Jovem Aprendiz",
    vacancy_type_associate: "Associado",
    vacancy_type_freelancer: "Pessoa Jurídica / PJ",
    vacancy_legal_entity: "PJ / Pessoa Jurídica",
    vacancy_type_trainee: "Trainee",
  };
  return map[type] || type.replace(/^vacancy_type_/, "");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Gupy API Proxy
  app.get("/api/jobs", async (req, res) => {
    try {
      const { searchTerm, offset = 0, workplaceType = "remote", state = "", limit = 100 } = req.query;
      
      const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

      const fetchWithHeaders = async (useComplexHeaders: boolean) => {
        // Gupy Portal's active API endpoint
        const gupyUrl = new URL("https://portal.gupy.io/api/job-search/jobs");
        gupyUrl.searchParams.append("limit", String(parsedLimit));
        gupyUrl.searchParams.append("offset", String(offset));
        if (searchTerm) gupyUrl.searchParams.append("jobName", String(searchTerm));
        if (workplaceType && workplaceType !== "all") {
          gupyUrl.searchParams.append("workplaceType", String(workplaceType));
        }
        if (state && state !== "Todos") {
          gupyUrl.searchParams.append("state", String(state));
        }

        const headers: Record<string, string> = useComplexHeaders ? {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://portal.gupy.io/',
          'Origin': 'https://portal.gupy.io',
        } : {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        try {
          return await fetch(gupyUrl.toString(), { 
            headers,
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };

      // Try complex headers first
      let response = await fetchWithHeaders(true);

      // If blocked (403, 401) or other error, try simple headers
      if (!response.ok && (response.status === 403 || response.status === 401)) {
        console.warn(`Gupy API blocked with complex headers (${response.status}). Retrying with simple headers...`);
        response = await fetchWithHeaders(false);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Sem detalhes");
        console.error(`Gupy API Error: ${response.status} - ${errorText.substring(0, 200)}`);
        
        if (response.status === 403) {
          throw new Error("Acesso temporariamente bloqueado pela Gupy. Tente novamente em alguns segundos.");
        }
        throw new Error(`A API da Gupy retornou status ${response.status}`);
      }

      const textData = await response.text();
      let rawData: any;
      try {
        rawData = JSON.parse(textData);
      } catch (e) {
        console.error("Failed to parse Gupy response as JSON. Response starts with:", textData.substring(0, 100));
        throw new Error("A API da Gupy retornou um formato inesperado. Tente novamente.");
      }

      // Format and normalize jobs to match frontend expectations
      const formattedJobs = (rawData.data || []).map((job: any) => ({
        ...job,
        companyName: job.companyName || job.careerPageName || "Empresa Confidencial",
        careerPageName: job.careerPageName || job.companyName || "Empresa Confidencial",
        isRemoteWork: job.isRemoteWork ?? (job.workplaceType === "remote"),
        type: formatJobType(job.type),
      }));

      res.json({
        data: formattedJobs,
        pagination: rawData.pagination || { total: formattedJobs.length, offset: Number(offset), limit: parsedLimit }
      });
    } catch (error: any) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: error.message || "Erro desconhecido ao conectar com a Gupy" });
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
