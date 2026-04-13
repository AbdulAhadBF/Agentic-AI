import { ai, MODELS } from "@/src/lib/gemini";
import { Type } from "@google/genai";

export type TaskType = "Generative" | "Analytical" | "Conversational" | "Agentic";

export interface AgentStep {
  id: string;
  agent: string;
  action: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: any;
}

export interface TaskAnalysis {
  type: TaskType;
  reasoning: string;
  suggestedModel: string;
  executionPlan: string[];
}

export class AgenticSystem {
  private static async callModel(model: string, prompt: string, systemInstruction?: string): Promise<string> {
    // If it's a Gemini model, call directly from frontend
    if (model.includes("gemini")) {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { systemInstruction }
      });
      return response.text || "";
    }

    // Otherwise, proxy through backend to hide API keys
    const response = await fetch("/api/agent/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, systemInstruction })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to call model");
    }

    const data = await response.json();
    return data.text;
  }

  private static async analyzeTask(query: string, context?: string): Promise<TaskAnalysis> {
    const prompt = `Analyze the following user query and classify it into one of these types: Generative, Analytical, Conversational, Agentic.
      
      Query: "${query}"
      Context: ${context || "None"}
      
      Provide the result in JSON format with the following schema:
      {
        "type": "Generative" | "Analytical" | "Conversational" | "Agentic",
        "reasoning": "string",
        "suggestedModel": "string",
        "executionPlan": ["step 1", "step 2", ...]
      }`;

    const response = await ai.models.generateContent({
      model: MODELS.FLASH,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            suggestedModel: { type: Type.STRING },
            executionPlan: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["type", "reasoning", "suggestedModel", "executionPlan"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  }

  static async runWorkflow(
    query: string, 
    files: any[], 
    onProgress: (step: AgentStep) => void
  ) {
    const context = files.map(f => `File: ${f.name}\nContent: ${f.content}`).join("\n\n");
    
    // 1. Task Analysis
    const analysisStep: AgentStep = {
      id: "analysis",
      agent: "Task Analyzer",
      action: "Analyzing query and classifying task type",
      status: "running"
    };
    onProgress(analysisStep);
    
    const analysis = await this.analyzeTask(query, context);
    onProgress({ ...analysisStep, status: "completed", result: analysis });

    // 2. Execution Steps
    const steps: AgentStep[] = analysis.executionPlan.map((action, index) => ({
      id: `step-${index}`,
      agent: "Execution Agent",
      action,
      status: "pending"
    }));

    for (const step of steps) {
      onProgress({ ...step, status: "running" });
      
      try {
        const result = await this.callModel(
          analysis.suggestedModel || MODELS.FLASH,
          `Task: ${step.action}\nOriginal Query: ${query}\nContext: ${context}\n\nExecute this specific step and provide the result.`
        );
        onProgress({ ...step, status: "completed", result });
      } catch (error: any) {
        // Fallback to Gemini if other models fail or keys are missing
        const fallbackResult = await this.callModel(
          MODELS.FLASH,
          `Task: ${step.action}\nOriginal Query: ${query}\nContext: ${context}\n\nExecute this specific step and provide the result.`
        );
        onProgress({ ...step, status: "completed", result: `(Fallback used) ${fallbackResult}` });
      }
    }

    // 3. Final Response Generation
    const finalStep: AgentStep = {
      id: "final",
      agent: "Response Generator",
      action: "Synthesizing all results into a final response",
      status: "running"
    };
    onProgress(finalStep);

    const finalResponse = await this.callModel(
      MODELS.PRO,
      `Original Query: ${query}\nContext: ${context}\nSteps Taken: ${JSON.stringify(steps)}\n\nGenerate a comprehensive final response based on the execution results.`
    );

    onProgress({ ...finalStep, status: "completed", result: finalResponse });
    
    return finalResponse;
  }
}
