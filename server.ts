import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import cors from "cors";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import mammoth from "mammoth";
import { v4 as uuidv4 } from "uuid";
import Tesseract from "tesseract.js";

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
  const anthropic = process.env.CLAUDE_API_KEY ? new Anthropic({ apiKey: process.env.CLAUDE_API_KEY }) : null;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // Temporary storage for uploaded files
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  });

  const upload = multer({ 
    storage,
    limits: { fileSize: 400 * 1024 * 1024 } // 400MB limit
  });

  // API Routes
  app.post("/api/upload", upload.array("files"), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const processedFiles = await Promise.all(
        files.map(async (file) => {
          let content = "";
          const fileType = path.extname(file.originalname).toLowerCase();

          if (fileType === ".pdf") {
            const dataBuffer = fs.readFileSync(file.path);
            const data = await pdf(dataBuffer);
            content = data.text;
          } else if (fileType === ".docx") {
            const dataBuffer = fs.readFileSync(file.path);
            const data = await mammoth.extractRawText({ buffer: dataBuffer });
            content = data.value;
          } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(fileType)) {
            // OCR for images
            const { data: { text } } = await Tesseract.recognize(file.path, 'eng');
            content = text;
          } else if ([".txt", ".csv", ".json"].includes(fileType)) {
            content = fs.readFileSync(file.path, "utf-8");
          }

          return {
            id: uuidv4(),
            name: file.originalname,
            type: fileType,
            size: file.size,
            path: file.path,
            content: content.substring(0, 50000), // Send a preview/first chunk to frontend
            fullContentLength: content.length
          };
        })
      );

      res.json({ files: processedFiles });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process files" });
    }
  });

  // Endpoint to get full content of a processed file (if needed)
  app.get("/api/files/:filename/content", (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) {
      res.json({ path: filePath });
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  app.post("/api/agent/execute", async (req, res) => {
    const { model, prompt, systemInstruction } = req.body;
    
    try {
      if (model.startsWith("gpt") && openai) {
        const response = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt }
          ],
        });
        return res.json({ text: response.choices[0].message.content });
      } 
      
      if (model.startsWith("claude") && anthropic) {
        const response = await anthropic.messages.create({
          model,
          max_tokens: 4096,
          system: systemInstruction,
          messages: [{ role: "user", content: prompt }],
        });
        return res.json({ text: (response.content[0] as any).text });
      }

      res.status(400).json({ error: "Model not supported or API key missing" });
    } catch (error: any) {
      console.error("Multi-model error:", error);
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
