import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Send, 
  FileText, 
  Image as ImageIcon, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Download,
  RefreshCw,
  Settings,
  History,
  LayoutDashboard,
  Cpu,
  Search,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AgenticSystem, AgentStep, TaskType } from "@/src/services/agentService";
import { cn } from "@/lib/utils";

interface FileInfo {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [taskType, setTaskType] = useState<TaskType | null>(null);
  const [activeTab, setActiveTab] = useState("chat");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps, finalResult]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    const formData = new FormData();
    for (let i = 0; i < uploadedFiles.length; i++) {
      formData.append("files", uploadedFiles[i]);
    }

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.files) {
        setFiles(prev => [...prev, ...data.files]);
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunTask = async () => {
    if (!query.trim()) return;

    setIsProcessing(true);
    setSteps([]);
    setFinalResult(null);
    setTaskType(null);
    setActiveTab("workflow");

    try {
      const result = await AgenticSystem.runWorkflow(query, files, (step) => {
        setSteps(prev => {
          const index = prev.findIndex(s => s.id === step.id);
          if (index >= 0) {
            const newSteps = [...prev];
            newSteps[index] = step;
            return newSteps;
          }
          return [...prev, step];
        });
        
        if (step.id === "analysis" && step.result) {
          setTaskType(step.result.type);
        }
      });
      setFinalResult(result);
    } catch (error) {
      console.error("Task failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-[#0A0A0A] text-white font-sans overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-white/10 bg-[#0F0F0F] flex flex-col">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <h1 className="font-bold text-lg tracking-tight">Agentic AI</h1>
            </div>

            <Button 
              onClick={() => {
                setQuery("");
                setSteps([]);
                setFinalResult(null);
                setTaskType(null);
                setActiveTab("chat");
              }}
              className="w-full justify-start gap-2 bg-white/5 hover:bg-white/10 text-white border-white/10 mb-6"
            >
              <Plus className="w-4 h-4" /> New Task
            </Button>

            <nav className="space-y-1">
              <Button variant="ghost" className="w-full justify-start gap-3 text-white/60 hover:text-white hover:bg-white/5">
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3 text-white/60 hover:text-white hover:bg-white/5">
                <History className="w-4 h-4" /> History
              </Button>
              <Button variant="ghost" className="w-full justify-start gap-3 text-white/60 hover:text-white hover:bg-white/5">
                <Settings className="w-4 h-4" /> Settings
              </Button>
            </nav>
          </div>

          <Separator className="bg-white/10" />

          <div className="flex-1 p-6 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">Knowledge Base</h2>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-white/40 hover:text-white"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3" />
              </Button>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              onChange={handleFileUpload}
            />

            <ScrollArea className="flex-1 -mx-2 px-2">
              <div className="space-y-2">
                {files.map(file => (
                  <div key={file.id} className="p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
                    <div className="flex items-center gap-3">
                      {file.type.includes("pdf") ? (
                        <FileText className="w-4 h-4 text-red-400" />
                      ) : file.type.includes("image") ? (
                        <ImageIcon className="w-4 h-4 text-blue-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-400" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-[10px] text-white/40">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  </div>
                ))}
                {isUploading && (
                  <div className="p-3 rounded-lg bg-white/5 border border-white/5 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <p className="text-sm text-white/40">Uploading...</p>
                  </div>
                )}
                {files.length === 0 && !isUploading && (
                  <div className="text-center py-8">
                    <p className="text-xs text-white/20">No documents uploaded</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col relative">
          {/* Header */}
          <header className="h-16 border-bottom border-white/10 flex items-center justify-between px-8 bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              {taskType && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-3 py-1">
                  {taskType} AI
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <Input 
                  placeholder="Search tasks..." 
                  className="bg-white/5 border-white/10 pl-10 w-64 h-9 text-sm focus:ring-blue-500/20"
                />
              </div>
              <Button variant="ghost" size="icon" className="text-white/60 hover:text-white">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-8 border-b border-white/10">
                <TabsList className="bg-transparent h-12 p-0 gap-8">
                  <TabsTrigger value="chat" className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none h-full px-0 text-white/40">
                    Task Input
                  </TabsTrigger>
                  <TabsTrigger value="workflow" className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none h-full px-0 text-white/40">
                    Execution Workflow
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="chat" className="h-full m-0 p-8 flex flex-col items-center justify-center">
                  <div className="max-w-2xl w-full space-y-8">
                    <div className="text-center space-y-4">
                      <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                        What should I execute today?
                      </h2>
                      <p className="text-white/40 text-lg">
                        Upload documents and images, then describe your task. I'll orchestrate the best models to deliver results.
                      </p>
                    </div>

                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                      <div className="relative bg-[#141414] border border-white/10 rounded-2xl p-4 shadow-2xl">
                        <Textarea 
                          placeholder="e.g., Analyze the uploaded financial reports and generate a summary with key insights and a follow-up email draft."
                          className="bg-transparent border-none focus-visible:ring-0 text-lg min-h-[120px] resize-none"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="text-white/40 hover:text-white hover:bg-white/5 gap-2">
                              <FileText className="w-4 h-4" /> Add Context
                            </Button>
                            <Button variant="ghost" size="sm" className="text-white/40 hover:text-white hover:bg-white/5 gap-2">
                              <ImageIcon className="w-4 h-4" /> Vision Task
                            </Button>
                          </div>
                          <Button 
                            onClick={handleRunTask}
                            disabled={isProcessing || !query.trim()}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-6 rounded-xl gap-2 shadow-lg shadow-blue-600/20"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Run Agent
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { title: "Document Analysis", desc: "Extract insights from PDFs & Docs" },
                        { title: "Data Synthesis", desc: "Combine multiple sources into reports" },
                        { title: "Task Automation", desc: "Multi-step agentic workflows" }
                      ].map((item, i) => (
                        <Card key={i} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                          <CardContent className="p-4 space-y-2">
                            <h3 className="font-semibold text-sm group-hover:text-blue-400 transition-colors">{item.title}</h3>
                            <p className="text-xs text-white/40">{item.desc}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="workflow" className="h-full m-0 p-0 flex">
                  <div className="flex-1 overflow-hidden flex flex-col border-r border-white/10">
                    <ScrollArea className="flex-1 p-8" ref={scrollRef}>
                      <div className="max-w-3xl mx-auto space-y-8">
                        {steps.map((step, i) => (
                          <motion.div 
                            key={step.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="relative pl-8 border-l border-white/10 pb-8 last:pb-0"
                          >
                            <div className={cn(
                              "absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-[#0A0A0A] z-10",
                              step.status === "completed" ? "bg-green-500" : 
                              step.status === "running" ? "bg-blue-500 animate-pulse" : "bg-white/10"
                            )} />
                            
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{step.agent}</span>
                                  <h3 className="font-semibold text-lg">{step.action}</h3>
                                </div>
                                {step.status === "completed" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                {step.status === "running" && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
                              </div>

                              {step.result && (
                                <Card className="bg-white/5 border-white/10">
                                  <CardContent className="p-4">
                                    <div className="text-sm text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
                                      {typeof step.result === "string" ? step.result : JSON.stringify(step.result, null, 2)}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </motion.div>
                        ))}

                        {finalResult && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="pt-8"
                          >
                            <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/30 shadow-2xl shadow-blue-500/10">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-xl font-bold">Final Output</CardTitle>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white">
                                    <Download className="w-4 h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/60 hover:text-white">
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-4">
                                <div className="prose prose-invert max-w-none">
                                  <p className="text-white/90 leading-relaxed whitespace-pre-wrap">
                                    {finalResult}
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Workflow Stats Sidebar */}
                  <aside className="w-80 bg-[#0F0F0F] p-6 space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">Execution Stats</h3>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Overall Progress</span>
                            <span className="text-blue-400">{Math.round((steps.filter(s => s.status === "completed").length / (steps.length || 1)) * 100)}%</span>
                          </div>
                          <Progress value={(steps.filter(s => s.status === "completed").length / (steps.length || 1)) * 100} className="h-1 bg-white/10" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                            <p className="text-[10px] text-white/40 uppercase">Tokens Used</p>
                            <p className="text-lg font-bold">~12.4k</p>
                          </div>
                          <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                            <p className="text-[10px] text-white/40 uppercase">Latency</p>
                            <p className="text-lg font-bold">4.2s</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">Active Agents</h3>
                      <div className="space-y-2">
                        {[
                          { name: "Task Analyzer", status: "Idle", color: "bg-green-500" },
                          { name: "Model Router", status: "Idle", color: "bg-green-500" },
                          { name: "Execution Agent", status: isProcessing ? "Active" : "Idle", color: isProcessing ? "bg-blue-500 animate-pulse" : "bg-green-500" },
                          { name: "Response Generator", status: "Idle", color: "bg-green-500" }
                        ].map((agent, i) => (
                          <div key={i} className="flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-2 h-2 rounded-full", agent.color)} />
                              <span className="text-sm font-medium">{agent.name}</span>
                            </div>
                            <span className="text-[10px] text-white/40">{agent.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                      <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-semibold text-blue-400">AI Reasoning</h4>
                      </div>
                      <p className="text-xs text-blue-400/80 leading-relaxed">
                        Currently using Gemini 3.1 Pro for high-reasoning tasks and Flash for rapid analysis. Failover routing enabled for OpenAI/Claude.
                      </p>
                    </div>
                  </aside>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
