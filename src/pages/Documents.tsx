import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Document,
  ChatMessage,
  Feedback,
  EvaluationResult,
  DebateResponse,
  QuestionResult,
} from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { cn, humanizeFilename } from "@/lib/utils";
import {
  MessageSquare,
  FileText,
  ClipboardEdit,
  Wand2,
  Send,
  X,
  Search,
  Loader2,
  Scale,
  Trophy,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [activeTab, setActiveTab] = useState("evaluations");
  const [searchQuery, setSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [relevanceFilter, setRelevanceFilter] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [evaluationData, setEvaluationData] = useState<any | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);
  const [prompts, setPrompts] = useState<any | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<"pro" | "con" | "judge">(
    "pro"
  );
  const [editedPrompt, setEditedPrompt] = useState<string>("");
  const [promptModified, setPromptModified] = useState<boolean>(false);
  const [reEvaluating, setReEvaluating] = useState<boolean>(false);
  const [experimentResult, setExperimentResult] = useState<any | null>(null);

  const normalizeRelevance = (value: string | null | undefined) => {
    if (!value) return "PENDING";
    const normalized = value.toUpperCase();
    if (normalized === "NOT_RELEVANT") return "NON_RELEVANT";
    return normalized;
  };

  // Feedback form state
  const [feedbackForm, setFeedbackForm] = useState({
    proStrengths: "",
    proWeaknesses: "",
    conStrengths: "",
    conWeaknesses: "",
    judgeBalance: "",
    observedBehavior: "",
    verdictCorrectness: "correct",
    suggestedVerdict: "RELEVANT",
    suggestions: "",
  });

  // Load documents from API
  useEffect(() => {
    loadDocuments();
  }, [searchQuery, relevanceFilter]);

  // Load prompts on mount
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const data = await apiClient.getPrompts();
        setPrompts(data);
      } catch (error: any) {
        console.error("Failed to load prompts:", error);
      }
    };
    loadPrompts();
  }, []);

  // Update editedPrompt when selectedPrompt changes
  useEffect(() => {
    if (prompts?.[selectedPrompt]) {
      setEditedPrompt(prompts[selectedPrompt]);
      setPromptModified(false);
    }
  }, [selectedPrompt, prompts]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let isActive = true;

    const loadPdf = async () => {
      if (!selectedDoc) {
        setPdfUrl(null);
        setPdfError(null);
        setPdfLoading(false);
        return;
      }

      setPdfLoading(true);
      setPdfError(null);

      try {
        const blob = await apiClient.downloadOriginalPdf(selectedDoc.id);
        objectUrl = URL.createObjectURL(blob);
        if (isActive) {
          setPdfUrl(objectUrl);
        }
      } catch (error: any) {
        if (isActive) {
          setPdfUrl(null);
          setPdfError(error.message || "PDF report not available");
        }
      } finally {
        if (isActive) {
          setPdfLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedDoc?.id]);

  // Load evaluation data when document is selected
  useEffect(() => {
    if (!selectedDoc) {
      setEvaluationData(null);
      return;
    }

    const loadEvaluation = async () => {
      setEvaluationLoading(true);
      try {
        const data = await apiClient.getDocumentEvaluation(selectedDoc.id);
        setEvaluationData(data);
      } catch (error: any) {
        console.error("Failed to load evaluation:", error);
        setEvaluationData(null);
      } finally {
        setEvaluationLoading(false);
      }
    };

    loadEvaluation();
  }, [selectedDoc?.id]);

  const mapDocuments = (docs: any[]) =>
    docs.map((doc: any) => ({
      id: doc.doc_id,
      title: doc.title,
      authors: doc.authors || [],
      doi: doc.doi,
      predictedRelevance: normalizeRelevance(doc.predicted_relevance),
      goldRelevance: doc.gold_relevance,
      avgProScore: doc.avg_pro_score,
      avgConScore: doc.avg_con_score,
      processedAt: doc.processed_at,
      abstract: doc.abstract,
    }));

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      if (relevanceFilter) params.relevance_filter = relevanceFilter;

      const [filteredResponse, allResponse] = await Promise.all([
        apiClient.getDocuments(params),
        apiClient.getDocuments({ limit: 200, offset: 0 }),
      ]);

      setDocuments(mapDocuments(filteredResponse.documents || []));
      setAllDocuments(mapDocuments(allResponse.documents || []));
    } catch (error: any) {
      toast({
        title: "Error loading documents",
        description: error.message || "Failed to load documents",
        variant: "destructive",
      });
      setDocuments([]);
      setAllDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents;

  const getRelevanceBadge = (relevance: string) => {
    const variants: Record<string, string> = {
      RELEVANT: "bg-primary text-primary-foreground",
      NON_RELEVANT: "bg-destructive text-destructive-foreground",
      BORDERLINE: "bg-yellow-500 text-primary-foreground",
    };
    return variants[relevance] || "bg-muted text-muted-foreground";
  };

  const getGoldBadgeClass = (relevance: string | null | undefined) => {
    if (!relevance || relevance === "NOT_SPECIFIED") {
      return "bg-muted text-muted-foreground";
    }
    return getRelevanceBadge(normalizeRelevance(relevance));
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedDoc) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, newMessage]);
    const userInput = chatInput;
    setChatInput("");
    setChatLoading(true);

    try {
      // Call real API
      const response = await apiClient.chatWithDocument(
        selectedDoc.id,
        userInput,
        "hybrid"
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.message,
        sources: response.sources || [],
        timestamp: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      toast({
        title: "Chat error",
        description: error.message,
        variant: "destructive",
      });

      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Sorry, I encountered an error processing your question. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!selectedDoc) return;

    try {
      await apiClient.submitFeedback(selectedDoc.id, {
        pro_strengths: feedbackForm.proStrengths,
        pro_weaknesses: feedbackForm.proWeaknesses,
        con_strengths: feedbackForm.conStrengths,
        con_weaknesses: feedbackForm.conWeaknesses,
        judge_balance: feedbackForm.judgeBalance,
        observed_behavior: feedbackForm.observedBehavior,
        verdict_correctness: feedbackForm.verdictCorrectness,
        suggested_verdict: feedbackForm.suggestedVerdict,
        suggestions: feedbackForm.suggestions,
      });
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback on this evaluation.",
      });
      // Reset form
      setFeedbackForm({
        proStrengths: "",
        proWeaknesses: "",
        conStrengths: "",
        conWeaknesses: "",
        judgeBalance: "",
        observedBehavior: "",
        verdictCorrectness: "correct",
        suggestedVerdict: "RELEVANT",
        suggestions: "",
      });
    } catch (error: any) {
      toast({
        title: "Error submitting feedback",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const accuracyCandidates = allDocuments.filter(
    (doc) => doc.goldRelevance && doc.goldRelevance !== "NOT_SPECIFIED"
  );
  const accuracyHits = accuracyCandidates.filter(
    (doc) => doc.predictedRelevance === doc.goldRelevance
  );
  const accuracyPercent =
    accuracyCandidates.length > 0
      ? Math.round((accuracyHits.length / accuracyCandidates.length) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold">Document Hub</h2>
          <p className="text-muted-foreground">
            Browse and interact with previously evaluated papers
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-right cursor-help">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Accuracy
                </p>
                <p className="text-2xl font-semibold leading-none">
                  {accuracyPercent !== null ? `${accuracyPercent}%` : "N/A"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {accuracyCandidates.length} labeled
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Accuracy is the percentage of documents with a gold label where
              the predicted relevance matches the gold label.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={relevanceFilter || "all"}
          onValueChange={(value) =>
            setRelevanceFilter(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by relevance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Documents</SelectItem>
            <SelectItem value="RELEVANT">Relevant</SelectItem>
            <SelectItem value="NON_RELEVANT">Non-Relevant</SelectItem>
            <SelectItem value="BORDERLINE">Borderline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Document Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Predicted</TableHead>
                <TableHead>Gold</TableHead>
                <TableHead className="text-right">Pro Score</TableHead>
                <TableHead className="text-right">Con Score</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Loading documents...
                    </p>
                  </TableCell>
                </TableRow>
              ) : filteredDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-muted-foreground">
                      No documents found
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs.map((doc) => (
                  <TableRow
                    key={doc.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedDoc?.id === doc.id && "bg-accent"
                    )}
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {humanizeFilename(doc.title)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={getRelevanceBadge(doc.predictedRelevance)}
                      >
                        {doc.predictedRelevance}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getGoldBadgeClass(doc.goldRelevance)}>
                        {doc.goldRelevance &&
                        doc.goldRelevance !== "NOT_SPECIFIED"
                          ? doc.goldRelevance
                          : "Not Set"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {doc.avgProScore != null
                        ? doc.avgProScore.toFixed(1)
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {doc.avgConScore != null
                        ? doc.avgConScore.toFixed(1)
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.processedAt
                        ? new Date(doc.processedAt).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Document Detail Panel */}
      {selectedDoc && (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                {humanizeFilename(selectedDoc.title)}
              </CardTitle>
              <CardDescription>
                {selectedDoc.authors.join(", ")}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedDoc(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="evaluations" className="gap-2">
                  <Scale className="h-4 w-4" />
                  Evaluations
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="feedback" className="gap-2">
                  <ClipboardEdit className="h-4 w-4" />
                  Feedback
                </TabsTrigger>
                <TabsTrigger value="prompts" className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  Prompts
                </TabsTrigger>
              </TabsList>

              {/* Chat Tab */}
              <TabsContent value="chat" className="mt-4">
                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <ScrollArea className="h-[400px] border rounded-lg p-4">
                      <div className="space-y-4">
                        {chatMessages.length === 0 ? (
                          <div className="text-center text-muted-foreground py-12">
                            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">
                              Start a conversation about this paper
                            </p>
                          </div>
                        ) : (
                          chatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className={cn(
                                "p-3 rounded-lg",
                                msg.role === "user"
                                  ? "bg-primary text-primary-foreground ml-8"
                                  : "bg-muted mr-8"
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">
                                {msg.content}
                              </p>
                              {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-border/50">
                                  <p className="text-xs font-medium mb-1">
                                    Sources:
                                  </p>
                                  {msg.sources.map((src, i) => (
                                    <p key={i} className="text-xs opacity-80">
                                      Page {src.page}: "{src.text}"
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                        {chatLoading && (
                          <div className="flex items-center gap-2 text-muted-foreground p-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <p className="text-sm">Thinking...</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ask a question about this paper..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          !chatLoading &&
                          handleSendMessage()
                        }
                        disabled={chatLoading}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={chatLoading || !chatInput.trim()}
                      >
                        {chatLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 bg-muted/30 min-h-[400px]">
                    {pdfLoading ? (
                      <div className="flex items-center justify-center text-muted-foreground h-[400px]">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <p className="text-sm">Loading PDF...</p>
                      </div>
                    ) : pdfUrl ? (
                      <iframe
                        title="PDF report"
                        src={pdfUrl}
                        className="w-full h-[500px] rounded-md"
                      />
                    ) : (
                      <div className="flex items-center justify-center text-muted-foreground h-[400px]">
                        <div className="text-center">
                          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">PDF Viewer</p>
                          <p className="text-xs">
                            {pdfError ||
                              "No report available for this document."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Evaluations Tab */}
              <TabsContent value="evaluations" className="mt-4">
                {evaluationLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <p className="text-sm text-muted-foreground">
                      Loading evaluation data...
                    </p>
                  </div>
                ) : !evaluationData ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Scale className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">
                      No evaluation data available for this document
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Overall Scores */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Trophy className="h-5 w-5" />
                          Overall Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-primary/10 rounded-lg">
                            <p className="text-2xl font-bold text-primary">
                              {evaluationData.evaluation?.pro_wins || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Pro Wins
                            </p>
                          </div>
                          <div className="text-center p-3 bg-destructive/10 rounded-lg">
                            <p className="text-2xl font-bold text-destructive">
                              {evaluationData.evaluation?.con_wins || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Con Wins
                            </p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-2xl font-bold">
                              {evaluationData.evaluation?.ties || 0}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Ties
                            </p>
                          </div>
                          <div className="text-center p-3 bg-accent rounded-lg">
                            <Badge
                              className={cn(
                                "text-sm",
                                selectedDoc.predictedRelevance === "RELEVANT"
                                  ? "bg-primary"
                                  : "bg-destructive"
                              )}
                            >
                              {selectedDoc.predictedRelevance}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              Verdict
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Debate Arguments */}
                    {evaluationData.debate &&
                      Array.isArray(evaluationData.debate) &&
                      evaluationData.debate.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <MessageSquare className="h-5 w-5" />
                              Pro/Con Debate
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Accordion
                              type="single"
                              collapsible
                              className="w-full"
                            >
                              {evaluationData.debate.map(
                                (item: any, index: number) => (
                                  <AccordionItem
                                    key={index}
                                    value={`debate-${index}`}
                                  >
                                    <AccordionTrigger className="text-left">
                                      <span className="pr-4">
                                        Q{index + 1}: {item.question}
                                      </span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="grid md:grid-cols-2 gap-4 pt-2">
                                        <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                                          <p className="font-semibold text-primary mb-2">
                                            Pro Argument
                                          </p>
                                          <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                                            <ReactMarkdown>
                                              {item.pro_argument ||
                                                item.proArgument}
                                            </ReactMarkdown>
                                          </div>
                                        </div>
                                        <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                                          <p className="font-semibold text-destructive mb-2">
                                            Con Argument
                                          </p>
                                          <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                                            <ReactMarkdown>
                                              {item.con_argument ||
                                                item.conArgument}
                                            </ReactMarkdown>
                                          </div>
                                        </div>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )
                              )}
                            </Accordion>
                          </CardContent>
                        </Card>
                      )}

                    {/* Judge Panel Evaluations */}
                    {evaluationData.evaluation?.questions &&
                      Array.isArray(evaluationData.evaluation.questions) &&
                      evaluationData.evaluation.questions.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Users className="h-5 w-5" />
                              Judge Panel Assessments
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Accordion
                              type="single"
                              collapsible
                              className="w-full"
                            >
                              {evaluationData.evaluation.questions.map(
                                (q: any, index: number) => (
                                  <AccordionItem
                                    key={index}
                                    value={`judge-${index}`}
                                  >
                                    <AccordionTrigger>
                                      <div className="flex items-center gap-3 pr-4 w-full">
                                        <span className="text-left flex-1">
                                          Q{index + 1}: {q.question}
                                        </span>
                                        <Badge
                                          variant={
                                            q.winner === "pro"
                                              ? "default"
                                              : q.winner === "con"
                                              ? "destructive"
                                              : "secondary"
                                          }
                                        >
                                          {q.winner?.toUpperCase()} wins
                                        </Badge>
                                      </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                      <div className="space-y-4 pt-2">
                                        <div className="flex flex-wrap gap-4 text-sm">
                                          <div>
                                            Pro:{" "}
                                            <span className="font-bold">
                                              {(
                                                q.pro_score || q.proScore
                                              )?.toFixed(1)}
                                            </span>
                                          </div>
                                          <div>
                                            Con:{" "}
                                            <span className="font-bold">
                                              {(
                                                q.con_score || q.conScore
                                              )?.toFixed(1)}
                                            </span>
                                          </div>
                                          <div>
                                            Kappa:{" "}
                                            <span className="font-mono">
                                              {q.kappa?.toFixed(2)}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="bg-muted/50 p-4 rounded-lg">
                                          <p className="text-xs font-medium text-muted-foreground mb-2">
                                            Judge Panel Consensus Summary
                                          </p>
                                          <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                                            {q.summary
                                              ?.split("|")
                                              .map(
                                                (
                                                  reasoning: string,
                                                  idx: number
                                                ) => (
                                                  <div
                                                    key={idx}
                                                    className={
                                                      idx > 0
                                                        ? "mt-3 pt-3 border-t border-border/50"
                                                        : ""
                                                    }
                                                  >
                                                    <p className="text-xs text-muted-foreground mb-1">
                                                      Judge {idx + 1}
                                                    </p>
                                                    <ReactMarkdown>
                                                      {reasoning.trim()}
                                                    </ReactMarkdown>
                                                  </div>
                                                )
                                              )}
                                          </div>
                                        </div>
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )
                              )}
                            </Accordion>
                          </CardContent>
                        </Card>
                      )}
                  </div>
                )}
              </TabsContent>

              {/* Feedback Tab */}
              <TabsContent value="feedback" className="mt-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Pro Strengths</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="What did the Pro agent do well?"
                        value={feedbackForm.proStrengths}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            proStrengths: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Pro Weaknesses</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Where could Pro improve?"
                        value={feedbackForm.proWeaknesses}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            proWeaknesses: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Con Strengths</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="What did the Con agent do well?"
                        value={feedbackForm.conStrengths}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            conStrengths: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Con Weaknesses</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Where could Con improve?"
                        value={feedbackForm.conWeaknesses}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            conWeaknesses: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label>Judge Balance</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Were the judges fair and balanced?"
                        value={feedbackForm.judgeBalance}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            judgeBalance: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Observed Behavior</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Any unexpected behaviors?"
                        value={feedbackForm.observedBehavior}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            observedBehavior: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Verdict Correctness</Label>
                      <Select
                        value={feedbackForm.verdictCorrectness}
                        onValueChange={(value) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            verdictCorrectness: value,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="correct">Correct</SelectItem>
                          <SelectItem value="partially_correct">
                            Partially Correct
                          </SelectItem>
                          <SelectItem value="incorrect">Incorrect</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Suggested Verdict</Label>
                      <Select
                        value={feedbackForm.suggestedVerdict}
                        onValueChange={(value) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            suggestedVerdict: value,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="RELEVANT">Relevant</SelectItem>
                          <SelectItem value="NON_RELEVANT">
                            Non-Relevant
                          </SelectItem>
                          <SelectItem value="BORDERLINE">Borderline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Suggestions</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="Any other suggestions?"
                        value={feedbackForm.suggestions}
                        onChange={(e) =>
                          setFeedbackForm({
                            ...feedbackForm,
                            suggestions: e.target.value,
                          })
                        }
                      />
                    </div>
                    <Button onClick={handleFeedbackSubmit} className="w-full">
                      Submit Feedback
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Prompts Tab */}
              <TabsContent value="prompts" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label>Select Prompt</Label>
                      <Select
                        value={selectedPrompt}
                        onValueChange={(v) =>
                          setSelectedPrompt(v as "pro" | "con" | "judge")
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pro">Pro Agent Prompt</SelectItem>
                          <SelectItem value="con">Con Agent Prompt</SelectItem>
                          <SelectItem value="judge">Judge Prompt</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {promptModified && (
                      <Badge variant="secondary" className="ml-4">
                        Modified
                      </Badge>
                    )}
                  </div>
                  <div>
                    <Label>Prompt Content</Label>
                    <Textarea
                      className="mt-1 font-mono text-xs"
                      rows={20}
                      value={editedPrompt}
                      onChange={(e) => {
                        setEditedPrompt(e.target.value);
                        setPromptModified(
                          e.target.value !== prompts?.[selectedPrompt]
                        );
                      }}
                      placeholder="Loading prompt..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditedPrompt(prompts?.[selectedPrompt] || "");
                        setPromptModified(false);
                        setExperimentResult(null);
                      }}
                      disabled={!promptModified}
                    >
                      Reset to Default
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!selectedDoc) return;

                        setReEvaluating(true);
                        try {
                          const result = await apiClient.reEvaluateDocument(
                            selectedDoc.doc_id,
                            selectedPrompt,
                            editedPrompt
                          );
                          setExperimentResult(result);
                          toast({
                            title: "Re-evaluation Complete",
                            description: "Document has been re-evaluated with your custom prompt.",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Re-evaluation Failed",
                            description: error.message || "Failed to re-evaluate document",
                            variant: "destructive",
                          });
                        } finally {
                          setReEvaluating(false);
                        }
                      }}
                      disabled={!promptModified || reEvaluating}
                    >
                      {reEvaluating ? "Re-evaluating..." : "Re-evaluate Document"}
                    </Button>
                  </div>

                  {/* Experiment Results Comparison */}
                  {experimentResult && (
                    <div className="mt-6 space-y-4 border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Experiment Results</h3>
                        <Badge variant={experimentResult.improvements.is_improvement ? "default" : "secondary"}>
                          {experimentResult.improvements.is_improvement ? "✓ Improvement" : "No Change"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Original Scores */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Original Evaluation</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pro Score:</span>
                              <span className="font-mono">{experimentResult.original_scores.avg_pro_score.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Con Score:</span>
                              <span className="font-mono">{experimentResult.original_scores.avg_con_score.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Difference:</span>
                              <span className="font-mono">{(experimentResult.original_scores.avg_pro_score - experimentResult.original_scores.avg_con_score).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Verdict:</span>
                              <Badge variant="outline" className="text-xs">{experimentResult.original_scores.overall_relevance}</Badge>
                            </div>
                          </div>
                        </div>

                        {/* New Scores */}
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Experiment Results</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pro Score:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{experimentResult.new_scores.avg_pro_score.toFixed(2)}</span>
                                {experimentResult.improvements.pro_score_delta !== 0 && (
                                  <span className={experimentResult.improvements.pro_score_delta > 0 ? "text-green-600" : "text-red-600"}>
                                    {experimentResult.improvements.pro_score_delta > 0 ? "▲" : "▼"} {Math.abs(experimentResult.improvements.pro_score_delta).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Con Score:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{experimentResult.new_scores.avg_con_score.toFixed(2)}</span>
                                {experimentResult.improvements.con_score_delta !== 0 && (
                                  <span className={experimentResult.improvements.con_score_delta > 0 ? "text-green-600" : "text-red-600"}>
                                    {experimentResult.improvements.con_score_delta > 0 ? "▲" : "▼"} {Math.abs(experimentResult.improvements.con_score_delta).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Difference:</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{(experimentResult.new_scores.avg_pro_score - experimentResult.new_scores.avg_con_score).toFixed(2)}</span>
                                {experimentResult.improvements.more_decisive && (
                                  <span className="text-green-600 text-xs">More Decisive!</span>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Verdict:</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">{experimentResult.new_scores.overall_relevance}</Badge>
                                {experimentResult.improvements.relevance_upgraded && (
                                  <span className="text-green-600 text-xs">✓ Upgraded</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground italic">
                        Experiment ID: {experimentResult.experiment_id}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Modify the prompt and click "Re-evaluate Document" to see how score changes.
                    Results are saved as experiments for admin review but do not affect the original evaluation.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
