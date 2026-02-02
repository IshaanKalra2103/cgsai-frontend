import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import EvaluationResults from "@/components/evaluation/EvaluationResults";
import PipelineProgress from "@/components/evaluation/PipelineProgress";
import { RelevanceStatus, DocumentMetadata, DebateResponse } from "@/types";
import { Upload, Play, Settings2, AlertTriangle, FileText } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useEvaluation } from "@/contexts/EvaluationContext";
import { usePipelineStream } from "@/hooks/usePipelineStream";

const DEFAULT_RESEARCH_QUESTION = `Methane is a potent greenhouse gas and is emitted from oil and gas, coal, rice cultivation, enteric fermentation, manure, and waste sectors. We are interested in strategies/technologies to reduce its emissions. Does the paper discuss methods or technologies to mitigate methane emissions from any one of the sectors?`;

const normalizeRelevance = (value?: string | null) => {
  if (!value) return "NOT_SPECIFIED" as RelevanceStatus;
  const normalized = value.toUpperCase();
  if (normalized === "NOT_RELEVANT") return "NON_RELEVANT";
  return normalized as RelevanceStatus;
};

const normalizeMetadata = (metadata: any): DocumentMetadata => ({
  title: metadata?.title || "Untitled",
  authors: Array.isArray(metadata?.authors) ? metadata.authors : [],
  doi: metadata?.doi || undefined,
  publicationDate:
    metadata?.publication_date || metadata?.publicationDate || undefined,
  abstract: metadata?.abstract || undefined,
});

const normalizeDebate = (debate: any): DebateResponse[] => {
  // Handle nested structure from server: { session: { question_debates: [...] } }
  const questionDebates =
    debate?.session?.question_debates ||
    debate?.question_debates ||
    (Array.isArray(debate) ? debate : []);

  if (!Array.isArray(questionDebates)) return [];

  return questionDebates.map((item: any) => {
    // Extract pro and con arguments from agent_responses
    const agentResponses = item?.agent_responses || [];
    const proResponse = agentResponses.find((r: any) =>
      r?.agent_name?.toLowerCase().includes("pro")
    );
    const conResponse = agentResponses.find((r: any) =>
      r?.agent_name?.toLowerCase().includes("con")
    );

    return {
      question: item?.question_text || item?.question || "",
      proArgument:
        proResponse?.response || item?.pro_argument || item?.proArgument || "",
      conArgument:
        conResponse?.response || item?.con_argument || item?.conArgument || "",
    };
  });
};

const normalizeEvaluation = (evaluation: any) => ({
  id: evaluation?.id || evaluation?.job_id || "unknown",
  documentId: evaluation?.document_id || evaluation?.doc_id || "",
  overallRelevance: normalizeRelevance(
    evaluation?.overall_relevance || evaluation?.overallRelevance
  ),
  avgProScore: Number(
    evaluation?.avg_pro_score ?? evaluation?.avgProScore ?? 0
  ),
  avgConScore: Number(
    evaluation?.avg_con_score ?? evaluation?.avgConScore ?? 0
  ),
  proWins: Number(evaluation?.pro_wins ?? evaluation?.proWins ?? 0),
  conWins: Number(evaluation?.con_wins ?? evaluation?.conWins ?? 0),
  ties: Number(evaluation?.ties ?? evaluation?.tie_count ?? 0),
  summary: evaluation?.summary || "",
  questions: Array.isArray(evaluation?.questions)
    ? evaluation.questions.map((q: any) => ({
        question: q?.question || "",
        winner: q?.winner || "tie",
        proScore: Number(q?.pro_score ?? q?.proScore ?? 0),
        conScore: Number(q?.con_score ?? q?.conScore ?? 0),
        kappa: Number(q?.kappa ?? 0),
        summary: q?.summary || "",
        judges: Array.isArray(q?.judges)
          ? q.judges.map((j: any) => ({
              judgeId: j?.judge_id || j?.judgeId || "",
              proScore: Number(j?.pro_score ?? j?.proScore ?? 0),
              conScore: Number(j?.con_score ?? j?.conScore ?? 0),
              reasoning: j?.reasoning || "",
              quotes: j?.quotes || undefined,
            }))
          : [],
      }))
    : [],
  createdAt:
    evaluation?.created_at || evaluation?.createdAt || new Date().toISOString(),
});

const MOCK_RESULT: any = {
  id: "1",
  documentId: "doc-1",
  overallRelevance: "RELEVANT",
  avgProScore: 4.2,
  avgConScore: 2.8,
  proWins: 3,
  conWins: 1,
  ties: 1,
  summary:
    "The paper presents a comprehensive analysis of methane capture technologies applicable to livestock operations. The proposed membrane-based separation system shows promise with estimated 60% methane recovery rates. While implementation costs remain a challenge, the paper provides actionable pathways for near-term deployment.",
  questions: [
    {
      question:
        "Does the paper propose specific methane mitigation technologies?",
      winner: "pro",
      proScore: 4.5,
      conScore: 2.3,
      kappa: 0.78,
      summary:
        "Strong consensus that the paper details specific membrane-based capture systems.",
      judges: [
        {
          judgeId: "1",
          proScore: 5,
          conScore: 2,
          reasoning:
            "Clear technical specifications provided for the membrane system.",
        },
        {
          judgeId: "2",
          proScore: 4,
          conScore: 3,
          reasoning:
            "Technology is specific but lacks some implementation details.",
        },
        {
          judgeId: "3",
          proScore: 5,
          conScore: 2,
          reasoning: "Excellent technical depth with clear actionable steps.",
        },
        {
          judgeId: "4",
          proScore: 4,
          conScore: 2,
          reasoning: "Well-defined technology with practical applications.",
        },
        {
          judgeId: "5",
          proScore: 4,
          conScore: 3,
          reasoning:
            "Specific technology but some scalability questions remain.",
        },
      ],
    },
    {
      question: "Are quantitative methane reduction estimates provided?",
      winner: "pro",
      proScore: 4.0,
      conScore: 3.0,
      kappa: 0.65,
      summary:
        "Paper includes 60% recovery rate estimates with uncertainty ranges.",
      judges: [
        {
          judgeId: "1",
          proScore: 4,
          conScore: 3,
          reasoning:
            "Quantitative estimates provided but could be more rigorous.",
        },
        {
          judgeId: "2",
          proScore: 4,
          conScore: 3,
          reasoning: "Good estimates with reasonable uncertainty bounds.",
        },
        {
          judgeId: "3",
          proScore: 4,
          conScore: 3,
          reasoning: "Solid quantitative analysis overall.",
        },
        {
          judgeId: "4",
          proScore: 4,
          conScore: 3,
          reasoning: "Numbers are present and well-justified.",
        },
        {
          judgeId: "5",
          proScore: 4,
          conScore: 3,
          reasoning: "Adequate quantification for this stage of development.",
        },
      ],
    },
  ],
  createdAt: new Date().toISOString(),
};

const MOCK_METADATA: DocumentMetadata = {
  title: "Membrane-Based Methane Capture Systems for Agricultural Applications",
  authors: ["J. Smith", "A. Johnson", "M. Williams"],
  doi: "10.1234/methane.2024.001",
  publicationDate: "2024-06-15",
  abstract:
    "This paper presents a novel membrane-based methane capture system designed specifically for livestock operations. Our approach leverages selective polymer membranes to achieve methane recovery rates of up to 60% under field conditions. We provide detailed cost analysis and implementation pathways for commercial-scale deployment.",
};

const MOCK_DEBATE: DebateResponse[] = [
  {
    question:
      "Does the paper propose specific methane mitigation technologies?",
    proArgument:
      "The paper clearly describes a membrane-based methane capture system with specific polymer compositions (PDMS-based selective layers) and operational parameters. Technical specifications include membrane thickness (0.5-1.0 μm), operating pressure (2-5 bar), and module configurations suitable for barn-scale deployment.",
    conArgument:
      "While the paper mentions membrane technology, it lacks detailed engineering drawings and operational protocols necessary for actual implementation. The technology readiness level appears low, and key integration challenges with existing farm infrastructure are not addressed.",
  },
  {
    question: "Are quantitative methane reduction estimates provided?",
    proArgument:
      "The paper provides specific quantitative estimates: 60% methane recovery rate under optimal conditions, with sensitivity analysis showing 45-70% range depending on atmospheric conditions. Annual emission reduction potential is estimated at 15-20 tons CO2-equivalent per 100 cattle.",
    conArgument:
      "The quantitative estimates rely heavily on laboratory conditions that may not translate to real-world agricultural settings. Field validation data is limited to short-term pilots, and long-term performance degradation is not adequately modeled.",
  },
];

export default function Evaluation() {
  const [file, setFile] = useState<File | null>(null);
  const [groundTruth, setGroundTruth] =
    useState<RelevanceStatus>("NOT_SPECIFIED");
  const [researchQuestion, setResearchQuestion] = useState(
    DEFAULT_RESEARCH_QUESTION
  );
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Use evaluation context for persistent state across tab navigation
  const {
    state: evalState,
    startEvaluation,
    setResult,
    clearEvaluation,
    setProcessing,
  } = useEvaluation();
  const { jobId, isProcessing, elapsedTime, evaluationResult } = evalState;

  // SSE hook for real-time pipeline progress
  console.log("[Evaluation] Calling usePipelineStream with jobId:", jobId);
  const {
    stages: pipelineStages,
    currentStage,
    isComplete: sseComplete,
    error: sseError,
    result: sseResult,
  } = usePipelineStream(jobId);

  console.log("[Evaluation] SSE hook state:", {
    stagesCount: pipelineStages.length,
    currentStage,
    sseComplete,
    sseError: !!sseError,
    hasResult: !!sseResult,
  });

  // Handle SSE completion - fetch full results when pipeline completes
  useEffect(() => {
    if (sseComplete && jobId && isProcessing) {
      console.log("[SSE] Pipeline complete, fetching full results...");

      // Fetch the full results from the API
      apiClient
        .getResults(jobId)
        .then((results: any) => {
          console.log("📊 Full results fetched:", results);
          if (results.status === "completed") {
            setResult(results);
            toast({
              title: "Evaluation complete",
              description: "The paper has been successfully evaluated.",
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch results after SSE complete:", err);
          // SSE result might have the data we need
          if (sseResult) {
            setResult(sseResult);
          }
        });
    }
  }, [sseComplete, jobId, isProcessing, sseResult, setResult]);

  // Handle SSE errors
  useEffect(() => {
    if (sseError && isProcessing) {
      console.error("[SSE] Pipeline error:", sseError);
      setProcessing(false);
      toast({
        title: "Evaluation failed",
        description: sseError,
        variant: "destructive",
      });
    }
  }, [sseError, isProcessing, setProcessing]);

  // Debug: Log when evaluation result changes
  useEffect(() => {
    console.log("🎯 Evaluation Result Changed:", evaluationResult);
    console.log("🎯 Is Processing:", isProcessing);
    console.log("🎯 Job ID:", jobId);
  }, [evaluationResult, isProcessing, jobId]);

  // Model configurations
  const [metadataModel, setMetadataModel] = useState("gpt-4o-mini");
  const [debateModel, setDebateModel] = useState("gpt-4.1");
  const [judgeModels, setJudgeModels] = useState({
    J1: "gpt-4.1-2025-04-14",
    J2: "gpt-5-2025-08-07",
    J3: "gpt-4o",
    J4: "gpt-5.2-2025-12-11",
    J5: "gpt-5.2-2025-12-11",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF file.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setDuplicateWarning(null);
      clearEvaluation(); // This sets jobId to null, which triggers SSE cleanup
    }
  };

  const handleEvaluate = async () => {
    if (!file || groundTruth === "NOT_SPECIFIED") return;

    setDuplicateWarning(null);
    clearEvaluation();

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file);
      formData.append("question", researchQuestion);
      formData.append("ground_truth", groundTruth);
      formData.append("metadata_model", metadataModel);
      formData.append("debate_model", debateModel);
      formData.append("judge_models", JSON.stringify(judgeModels));

      // Upload paper
      const uploadResponse = await apiClient.uploadPaper(formData);

      // Check for duplicate
      if (uploadResponse.is_duplicate) {
        setDuplicateWarning(
          `This paper has already been processed (${uploadResponse.duplicate_type}). ` +
            `Previous evaluation: ${
              uploadResponse.existing_doc?.title || "Unknown"
            }. ` +
            `To re-run with new prompts, use the prompt re-evaluation section.`
        );
        return;
      }

      // Start evaluation with job ID - this triggers the timer in context
      startEvaluation(uploadResponse.job_id);

      // Start pipeline execution
      await apiClient.startPipeline(uploadResponse.job_id);

      toast({
        title: "Pipeline started",
        description: "Real-time progress will be streamed via SSE.",
      });

      // SSE hook will handle the rest - completion and errors are handled by useEffect hooks above
    } catch (error: any) {
      setProcessing(false);
      toast({
        title: "Evaluation failed",
        description: error.message || "An error occurred during processing.",
        variant: "destructive",
      });
    }
  };

  const canEvaluate = file && groundTruth !== "NOT_SPECIFIED" && !isProcessing;

  const normalizedResult = evaluationResult?.evaluation
    ? normalizeEvaluation(evaluationResult.evaluation)
    : null;
  const normalizedMetadata = evaluationResult?.metadata
    ? normalizeMetadata(evaluationResult.metadata)
    : null;
  const normalizedDebate = evaluationResult?.debate
    ? normalizeDebate(evaluationResult.debate)
    : null;

  console.log("🔍 Normalized Result:", normalizedResult);
  console.log("🔍 Normalized Metadata:", normalizedMetadata);
  console.log("🔍 Normalized Debate:", normalizedDebate);
  console.log("🔍 Evaluation Result:", evaluationResult);
  console.log("🔍 Is Processing:", isProcessing);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Paper Evaluation</h2>
        <p className="text-muted-foreground">
          Upload a PDF paper to evaluate its relevance to methane mitigation
          research
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column - Inputs */}
        <div className="space-y-6">
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Paper
              </CardTitle>
              <CardDescription>Select a PDF file to evaluate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="pdf-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-8 w-8 text-primary" />
                      <div className="text-left">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PDF files only
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Ground Truth Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Ground Truth Relevance</CardTitle>
              <CardDescription>
                Select the expected relevance classification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={groundTruth}
                onValueChange={(v) => setGroundTruth(v as RelevanceStatus)}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ground truth" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_SPECIFIED">Not Specified</SelectItem>
                  <SelectItem value="RELEVANT">Relevant</SelectItem>
                  <SelectItem value="NON_RELEVANT">Non-Relevant</SelectItem>
                </SelectContent>
              </Select>
              {groundTruth === "NOT_SPECIFIED" && (
                <p className="text-sm text-destructive mt-2">
                  Please select a ground truth value to proceed
                </p>
              )}
            </CardContent>
          </Card>

          {/* Research Question */}
          <Card>
            <CardHeader>
              <CardTitle>Research Question</CardTitle>
              <CardDescription>Define the evaluation criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={researchQuestion}
                onChange={(e) => setResearchQuestion(e.target.value)}
                rows={6}
                className="font-mono text-sm"
                disabled={isProcessing}
              />
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced">
              <AccordionTrigger className="px-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Advanced Settings
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div>
                    <Label>Metadata Model</Label>
                    <Select
                      value={metadataModel}
                      onValueChange={setMetadataModel}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                        <SelectItem value="gpt-4.1-2025-04-14">
                          GPT-4.1 (2025-04-14)
                        </SelectItem>
                        <SelectItem value="gpt-5-2025-08-07">
                          GPT-5 (2025-08-07)
                        </SelectItem>
                        <SelectItem value="gpt-5.1-2025-11-13">
                          GPT-5.1 (2025-11-13)
                        </SelectItem>
                        <SelectItem value="gpt-5-mini-2025-08-07">
                          GPT-5 Mini (2025-08-07)
                        </SelectItem>
                        <SelectItem value="gpt-5.2-2025-12-11">
                          GPT-5.2 (2025-12-11)
                        </SelectItem>
                        <SelectItem value="gpt-5.2-pro-2025-12-11">
                          GPT-5.2 Pro (2025-12-11)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Debate Model</Label>
                    <Select
                      value={debateModel}
                      onValueChange={setDebateModel}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                        <SelectItem value="gpt-4.1-2025-04-14">
                          GPT-4.1 (2025-04-14)
                        </SelectItem>
                        <SelectItem value="gpt-5-2025-08-07">
                          GPT-5 (2025-08-07)
                        </SelectItem>
                        <SelectItem value="gpt-5.1-2025-11-13">
                          GPT-5.1 (2025-11-13)
                        </SelectItem>
                        <SelectItem value="gpt-5-mini-2025-08-07">
                          GPT-5 Mini (2025-08-07)
                        </SelectItem>
                        <SelectItem value="gpt-5.2-2025-12-11">
                          GPT-5.2 (2025-12-11)
                        </SelectItem>
                        <SelectItem value="gpt-5.2-pro-2025-12-11">
                          GPT-5.2 Pro (2025-12-11)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-2">
                    <Label className="text-base font-semibold">
                      Judge Panel Models
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">
                      Configure each of the 5 judges in the evaluation panel
                    </p>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">J1 - Methods Judge</Label>
                        <Select
                          value={judgeModels.J1}
                          onValueChange={(v) =>
                            setJudgeModels({ ...judgeModels, J1: v })
                          }
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-4o-mini">
                              GPT-4o Mini
                            </SelectItem>
                            <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                            <SelectItem value="gpt-4.1-2025-04-14">
                              GPT-4.1 (2025-04-14)
                            </SelectItem>
                            <SelectItem value="gpt-5-2025-08-07">
                              GPT-5 (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.1-2025-11-13">
                              GPT-5.1 (2025-11-13)
                            </SelectItem>
                            <SelectItem value="gpt-5-mini-2025-08-07">
                              GPT-5 Mini (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-2025-12-11">
                              GPT-5.2 (2025-12-11)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-pro-2025-12-11">
                              GPT-5.2 Pro (2025-12-11)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm">J2 - Regulatory Judge</Label>
                        <Select
                          value={judgeModels.J2}
                          onValueChange={(v) =>
                            setJudgeModels({ ...judgeModels, J2: v })
                          }
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-4o-mini">
                              GPT-4o Mini
                            </SelectItem>
                            <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                            <SelectItem value="gpt-4.1-2025-04-14">
                              GPT-4.1 (2025-04-14)
                            </SelectItem>
                            <SelectItem value="gpt-5-2025-08-07">
                              GPT-5 (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.1-2025-11-13">
                              GPT-5.1 (2025-11-13)
                            </SelectItem>
                            <SelectItem value="gpt-5-mini-2025-08-07">
                              GPT-5 Mini (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-2025-12-11">
                              GPT-5.2 (2025-12-11)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-pro-2025-12-11">
                              GPT-5.2 Pro (2025-12-11)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm">J3 - TechnoEcon Judge</Label>
                        <Select
                          value={judgeModels.J3}
                          onValueChange={(v) =>
                            setJudgeModels({ ...judgeModels, J3: v })
                          }
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-4o-mini">
                              GPT-4o Mini
                            </SelectItem>
                            <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                            <SelectItem value="gpt-4.1-2025-04-14">
                              GPT-4.1 (2025-04-14)
                            </SelectItem>
                            <SelectItem value="gpt-5-2025-08-07">
                              GPT-5 (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.1-2025-11-13">
                              GPT-5.1 (2025-11-13)
                            </SelectItem>
                            <SelectItem value="gpt-5-mini-2025-08-07">
                              GPT-5 Mini (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-2025-12-11">
                              GPT-5.2 (2025-12-11)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-pro-2025-12-11">
                              GPT-5.2 Pro (2025-12-11)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm">
                          J4 - Applicability Judge
                        </Label>
                        <Select
                          value={judgeModels.J4}
                          onValueChange={(v) =>
                            setJudgeModels({ ...judgeModels, J4: v })
                          }
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-4o-mini">
                              GPT-4o Mini
                            </SelectItem>
                            <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                            <SelectItem value="gpt-4.1-2025-04-14">
                              GPT-4.1 (2025-04-14)
                            </SelectItem>
                            <SelectItem value="gpt-5-2025-08-07">
                              GPT-5 (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.1-2025-11-13">
                              GPT-5.1 (2025-11-13)
                            </SelectItem>
                            <SelectItem value="gpt-5-mini-2025-08-07">
                              GPT-5 Mini (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-2025-12-11">
                              GPT-5.2 (2025-12-11)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-pro-2025-12-11">
                              GPT-5.2 Pro (2025-12-11)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm">J5 - Skeptic Judge</Label>
                        <Select
                          value={judgeModels.J5}
                          onValueChange={(v) =>
                            setJudgeModels({ ...judgeModels, J5: v })
                          }
                          disabled={isProcessing}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                            <SelectItem value="gpt-4o-mini">
                              GPT-4o Mini
                            </SelectItem>
                            <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                            <SelectItem value="gpt-4.1-2025-04-14">
                              GPT-4.1 (2025-04-14)
                            </SelectItem>
                            <SelectItem value="gpt-5-2025-08-07">
                              GPT-5 (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.1-2025-11-13">
                              GPT-5.1 (2025-11-13)
                            </SelectItem>
                            <SelectItem value="gpt-5-mini-2025-08-07">
                              GPT-5 Mini (2025-08-07)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-2025-12-11">
                              GPT-5.2 (2025-12-11)
                            </SelectItem>
                            <SelectItem value="gpt-5.2-pro-2025-12-11">
                              GPT-5.2 Pro (2025-12-11)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Duplicate Warning */}
          {duplicateWarning && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Duplicate Detected</AlertTitle>
              <AlertDescription>{duplicateWarning}</AlertDescription>
            </Alert>
          )}

          {/* Evaluate Button */}
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleEvaluate}
            disabled={!canEvaluate}
          >
            <Play className="h-4 w-4" />
            Evaluate Paper
          </Button>
        </div>

        {/* Right Column - Progress / Results */}
        <div>
          {isProcessing && (
            <Card className="h-full min-h-[400px]">
              <CardHeader>
                <CardTitle>Evaluation Progress</CardTitle>
                <CardDescription>
                  Real-time pipeline status via Server-Sent Events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PipelineProgress
                  stages={pipelineStages}
                  currentStage={currentStage}
                  elapsedTime={elapsedTime}
                />
              </CardContent>
            </Card>
          )}

          {evaluationResult &&
            !isProcessing &&
            normalizedResult &&
            normalizedMetadata && (
              <EvaluationResults
                result={normalizedResult}
                metadata={normalizedMetadata}
                debate={normalizedDebate || []}
                docId={evaluationResult?.doc_id}
              />
            )}

          {!isProcessing &&
            (!evaluationResult || !normalizedResult || !normalizedMetadata) && (
              <Card className="h-full min-h-[400px] flex items-center justify-center">
                <CardContent className="text-center text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p>Upload a paper and start evaluation to see results here</p>
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}
