import { EvaluationResult, DocumentMetadata, DebateResponse } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, FileJson, FileText, Trophy, Scale, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

interface EvaluationResultsProps {
  result: EvaluationResult;
  metadata: DocumentMetadata;
  debate: DebateResponse[];
  docId?: string;
}

export default function EvaluationResults({ result, metadata, debate, docId }: EvaluationResultsProps) {
  const handleDownloadPdf = async () => {
    if (!docId) {
      toast({ title: "Error", description: "Document ID not available", variant: "destructive" });
      return;
    }
    try {
      const blob = await apiClient.downloadReportPdf(docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDownloadDebateJson = () => {
    const json = JSON.stringify(debate, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debate_${docId || 'results'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadEvaluationJson = () => {
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluation_${docId || 'results'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getRelevanceColor = (relevance: string) => {
    switch (relevance) {
      case 'RELEVANT': return 'bg-primary text-primary-foreground';
      case 'NON_RELEVANT': return 'bg-destructive text-destructive-foreground';
      case 'BORDERLINE': return 'bg-yellow-500 text-primary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Result Banner */}
      <Card className="border-2 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Overall Relevance</p>
              <Badge className={cn("text-lg px-4 py-1", getRelevanceColor(result.overallRelevance))}>
                {result.overallRelevance.replace('_', ' ')}
              </Badge>
            </div>
            
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{result.proWins}</p>
                <p className="text-xs text-muted-foreground">Pro Wins</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{result.conWins}</p>
                <p className="text-xs text-muted-foreground">Con Wins</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{result.ties}</p>
                <p className="text-xs text-muted-foreground">Ties</p>
              </div>
            </div>
            
            <div className="flex gap-4 text-center">
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-lg font-bold">{result.avgProScore.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Avg Pro</p>
              </div>
              <div className="p-3 bg-destructive/10 rounded-lg">
                <p className="text-lg font-bold">{result.avgConScore.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Avg Con</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Paper Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Paper Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-lg">{metadata.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {metadata.authors.join(', ')}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 text-sm">
            {metadata.doi && (
              <div>
                <span className="text-muted-foreground">DOI: </span>
                <span className="font-mono">{metadata.doi}</span>
              </div>
            )}
            {metadata.publicationDate && (
              <div>
                <span className="text-muted-foreground">Published: </span>
                <span>{metadata.publicationDate}</span>
              </div>
            )}
          </div>
          
          {metadata.abstract && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Abstract</p>
              <p className="text-sm leading-relaxed">{metadata.abstract}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Evaluation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.summary}</p>
        </CardContent>
      </Card>

      {/* Debate Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Debate Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {debate.map((item, index) => (
              <AccordionItem key={index} value={`debate-${index}`}>
                <AccordionTrigger className="text-left">
                  <span className="pr-4">Q{index + 1}: {item.question}</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <p className="font-semibold text-primary mb-2">Pro Argument</p>
                      <p className="text-sm">{item.proArgument}</p>
                    </div>
                    <div className="p-4 bg-destructive/5 rounded-lg border border-destructive/20">
                      <p className="font-semibold text-destructive mb-2">Con Argument</p>
                      <p className="text-sm">{item.conArgument}</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Judge Evaluations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Judge Panel Evaluations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {result.questions.map((q, index) => (
              <AccordionItem key={index} value={`judge-${index}`}>
                <AccordionTrigger>
                  <div className="flex items-center gap-3 pr-4">
                    <span className="text-left flex-1">Q{index + 1}: {q.question}</span>
                    <Badge variant={q.winner === 'pro' ? 'default' : q.winner === 'con' ? 'destructive' : 'secondary'}>
                      {q.winner.toUpperCase()} wins
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>Pro: <span className="font-bold">{q.proScore.toFixed(1)}</span></div>
                      <div>Con: <span className="font-bold">{q.conScore.toFixed(1)}</span></div>
                      <div>Kappa: <span className="font-mono">{q.kappa.toFixed(2)}</span></div>
                    </div>
                    <p className="text-sm bg-muted/50 p-3 rounded-lg">{q.summary}</p>
                    
                    <Separator />
                    
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Individual Judge Verdicts</p>
                      {q.judges.map((judge, jIndex) => (
                        <div key={jIndex} className="p-3 border rounded-lg text-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">Judge {jIndex + 1}</span>
                            <div className="flex gap-2">
                              <Badge variant="outline">Pro: {judge.proScore}</Badge>
                              <Badge variant="outline">Con: {judge.conScore}</Badge>
                            </div>
                          </div>
                          <p className="text-muted-foreground">{judge.reasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Downloads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={handleDownloadDebateJson}>
              <FileJson className="h-4 w-4" />
              Debate JSON
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleDownloadEvaluationJson}>
              <FileJson className="h-4 w-4" />
              Evaluation JSON
            </Button>
            <Button variant="outline" className="gap-2" onClick={handleDownloadPdf} disabled={!docId}>
              <FileText className="h-4 w-4" />
              PDF Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
