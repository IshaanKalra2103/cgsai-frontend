import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { LogEntry, PromptVersion, Feedback } from '@/types';
import { FileText, MessageSquare, Wand2, Users, Database, Download, Trash2, AlertTriangle, Shield, RefreshCw, UserPlus, Loader2, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';

export default function Admin() {
  // State
  const [users, setUsers] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<any | null>(null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Experiments state
  const [experiments, setExperiments] = useState<any[]>([]);
  const [experimentsLoading, setExperimentsLoading] = useState(false);
  const [experimentStats, setExperimentStats] = useState<any | null>(null);
  const [selectedExperiment, setSelectedExperiment] = useState<any | null>(null);
  const [isExperimentOpen, setIsExperimentOpen] = useState(false);
  const [experimentStatusFilter, setExperimentStatusFilter] = useState<string>('all');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const [logFilter, setLogFilter] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // New user form
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user' | 'viewer',
  });

  // Load data on mount
  useEffect(() => {
    loadUsers();
    loadStatistics();
    loadLoginAttempts();
    loadFeedback();
    loadPrompts();
    loadExperiments();
  }, []);

  // Reload experiments when filter changes
  useEffect(() => {
    loadExperiments();
  }, [experimentStatusFilter]);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await apiClient.getUsers();
      setUsers(response.users || response || []);
    } catch (error: any) {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive",
      });
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadStatistics = async () => {
    setStatsLoading(true);
    try {
      const stats = await apiClient.getStatistics();
      setStatistics(stats);
    } catch (error: any) {
      toast({
        title: "Error loading statistics",
        description: error.message,
        variant: "destructive",
      });
      setStatistics(null);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadLoginAttempts = async () => {
    try {
      const response = await apiClient.getLoginAttempts();
      setLoginAttempts(response.attempts || response || []);
    } catch (error: any) {
      console.error("Error loading login attempts:", error);
      setLoginAttempts([]);
    }
  };

  const loadFeedback = async () => {
    setFeedbackLoading(true);
    try {
      const response = await apiClient.getFeedback();
      setFeedback(response.feedback || response || []);
    } catch (error: any) {
      console.error("Error loading feedback:", error);
      setFeedback([]);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const loadPrompts = async () => {
    setPromptsLoading(true);
    try {
      const response = await apiClient.getAdminPrompts();
      setPrompts(response.prompts || response || []);
    } catch (error: any) {
      console.error("Error loading prompts:", error);
      setPrompts([]);
    } finally {
      setPromptsLoading(false);
    }
  };

  const loadExperiments = async () => {
    setExperimentsLoading(true);
    try {
      const statusParam = experimentStatusFilter !== 'all' ? experimentStatusFilter : undefined;
      const response = await apiClient.getExperiments({
        status: statusParam
      });
      setExperiments(response.experiments || []);
      setExperimentStats(response.statistics || null);
    } catch (error: any) {
      console.error("Error loading experiments:", error);
      setExperiments([]);
      setExperimentStats(null);
    } finally {
      setExperimentsLoading(false);
    }
  };

  const handleApproveExperiment = async (experimentId: string, action: 'set_default' | 're_evaluate_all') => {
    try {
      await apiClient.approveExperiment(experimentId, action, approveNotes);
      toast({
        title: "Experiment Approved",
        description: `Experiment approved successfully. Action: ${action === 'set_default' ? 'Set as Default' : 'Re-evaluate All'}`,
      });
      setIsExperimentOpen(false);
      setApproveNotes('');
      loadExperiments();
    } catch (error: any) {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejectExperiment = async (experimentId: string) => {
    if (!rejectReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejecting this experiment.",
        variant: "destructive",
      });
      return;
    }

    try {
      await apiClient.rejectExperiment(experimentId, rejectReason);
      toast({
        title: "Experiment Rejected",
        description: "Experiment has been rejected successfully.",
      });
      setIsExperimentOpen(false);
      setRejectReason('');
      loadExperiments();
    } catch (error: any) {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateUser = async () => {
    try {
      await apiClient.createUser(newUser);
      toast({
        title: "User created",
        description: `User ${newUser.email} has been created successfully.`,
      });
      setIsCreateUserOpen(false);
      setNewUser({ email: '', password: '', role: 'user' });
      loadUsers(); // Reload users list
    } catch (error: any) {
      toast({
        title: "Error creating user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-destructive';
      case 'WARNING': return 'text-yellow-600';
      case 'INFO': return 'text-primary';
      case 'DEBUG': return 'text-muted-foreground';
      default: return '';
    }
  };

  const handleDeleteAllDocuments = async () => {
    try {
      const response = await apiClient.deleteAllDocuments();
      toast({
        title: "Documents deleted",
        description: response.message,
      });
      setDeleteConfirm('');
      // Reload statistics
      loadStatistics();
    } catch (error: any) {
      toast({
        title: "Error deleting documents",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllFeedback = async () => {
    try {
      const response = await apiClient.deleteAllFeedback();
      toast({
        title: "Feedback deleted",
        description: response.message,
      });
      // Reload feedback
      loadFeedback();
    } catch (error: any) {
      toast({
        title: "Error deleting feedback",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResetAuthDatabase = async () => {
    try {
      const response = await apiClient.resetAuthDatabase();
      toast({
        title: "Auth database reset",
        description: response.message,
      });
      // Reload users
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Error resetting auth database",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportFeedbackCSV = () => {
    if (feedback.length === 0) {
      toast({
        title: "No data to export",
        description: "There is no feedback data to export.",
        variant: "destructive",
      });
      return;
    }

    // Define CSV headers
    const headers = [
      'Feedback ID',
      'Document ID',
      'Reviewer Email',
      'Verdict Correctness',
      'Suggested Verdict',
      'Pro Strengths',
      'Pro Weaknesses',
      'Con Strengths',
      'Con Weaknesses',
      'Judge Balance',
      'Observed Behavior',
      'Suggestions',
      'Submitted Date'
    ];

    // Helper function to escape CSV values
    const escapeCSV = (value: string | null | undefined) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // Escape double quotes and wrap in quotes if contains comma, newline, or quotes
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV rows
    const rows = feedback.map((fb) => [
      escapeCSV(fb.feedback_id),
      escapeCSV(fb.doc_id),
      escapeCSV(fb.user_email),
      escapeCSV(fb.verdict_correctness),
      escapeCSV(fb.suggested_verdict),
      escapeCSV(fb.pro_strengths),
      escapeCSV(fb.pro_weaknesses),
      escapeCSV(fb.con_strengths),
      escapeCSV(fb.con_weaknesses),
      escapeCSV(fb.judge_balance),
      escapeCSV(fb.observed_behavior),
      escapeCSV(fb.suggestions),
      escapeCSV(fb.timestamp ? new Date(fb.timestamp).toISOString() : '')
    ].join(','));

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `feedback_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: `Exported ${feedback.length} feedback records to CSV.`,
    });
  };

  const handleNuclearDelete = async () => {
    try {
      const response = await apiClient.nuclearDelete();
      toast({
        title: "Nuclear delete completed",
        description: response.message,
      });
      setDeleteConfirm('');
      // Reload all data
      loadUsers();
      loadStatistics();
      loadFeedback();
    } catch (error: any) {
      toast({
        title: "Error executing nuclear delete",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        <p className="text-muted-foreground">
          Manage system settings, users, and data
        </p>
      </div>

      {/* Statistics Cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading statistics...</span>
        </div>
      ) : statistics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.total_documents || 0}</div>
              <p className="text-xs text-muted-foreground">Evaluated papers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Relevant Papers</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.relevant_count || 0}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.total_documents > 0
                  ? `${((statistics.relevant_count / statistics.total_documents) * 100).toFixed(1)}%`
                  : '0%'} of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.active_users || 0}</div>
              <p className="text-xs text-muted-foreground">Total: {statistics.total_users || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Healthy</div>
              <p className="text-xs text-muted-foreground">All services operational</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-2">
            <Wand2 className="h-4 w-4" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="experiments" className="gap-2">
            <Wand2 className="h-4 w-4" />
            Experiments
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <Database className="h-4 w-4" />
            Data
          </TabsTrigger>
        </TabsList>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Login Attempts</CardTitle>
              <CardDescription>Recent authentication attempts and security events</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginAttempts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                        No login attempts recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    loginAttempts.slice(0, 10).map((attempt, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">
                          {new Date(attempt.attempted_at || attempt.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>{attempt.email}</TableCell>
                        <TableCell>
                          {attempt.success ? (
                            <Badge className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {attempt.ip_address || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>Application logs are currently managed by the backend system</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>Log Viewing</AlertTitle>
                <AlertDescription>
                  System logs can be viewed directly on the server or through log aggregation tools.
                  For production deployments, integrate with services like CloudWatch, Datadog, or ELK stack.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Feedback Records</CardTitle>
                <CardDescription>Review submitted feedback on evaluations</CardDescription>
              </div>
              <Button variant="outline" className="gap-2" onClick={handleExportFeedbackCSV}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-muted-foreground">Loading feedback...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Verdict</TableHead>
                      <TableHead>Suggested</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedback.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No feedback records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      feedback.map((fb) => (
                        <TableRow key={fb.feedback_id}>
                          <TableCell>{fb.user_email}</TableCell>
                          <TableCell className="font-mono text-sm">{fb.doc_id}</TableCell>
                          <TableCell>
                            <Badge variant={fb.verdict_correctness === 'correct' ? 'default' : 'destructive'}>
                              {fb.verdict_correctness || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>{fb.suggested_verdict || 'N/A'}</TableCell>
                          <TableCell>{new Date(fb.timestamp).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedFeedback(fb);
                                setIsFeedbackOpen(true);
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Feedback Details Dialog */}
          <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Feedback Details</DialogTitle>
                <DialogDescription>
                  Document: {selectedFeedback?.doc_id} | Reviewer: {selectedFeedback?.user_email}
                </DialogDescription>
              </DialogHeader>

              {selectedFeedback && (
                <div className="space-y-6">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Verdict Correctness:</span>
                      <Badge
                        variant={selectedFeedback.verdict_correctness === 'correct' ? 'default' :
                                selectedFeedback.verdict_correctness === 'partially_correct' ? 'secondary' : 'destructive'}
                        className="ml-2 capitalize"
                      >
                        {selectedFeedback.verdict_correctness || 'N/A'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Suggested Verdict:</span>
                      <Badge variant="outline" className="ml-2">
                        {selectedFeedback.suggested_verdict || 'N/A'}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>
                      <span className="ml-2">{new Date(selectedFeedback.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Pro Agent Feedback */}
                  <div>
                    <h3 className="font-semibold mb-3">Pro Agent Feedback</h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-muted-foreground">Strengths</Label>
                        <p className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                          {selectedFeedback.pro_strengths || 'No feedback provided'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Weaknesses</Label>
                        <p className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                          {selectedFeedback.pro_weaknesses || 'No feedback provided'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Con Agent Feedback */}
                  <div>
                    <h3 className="font-semibold mb-3">Con Agent Feedback</h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-muted-foreground">Strengths</Label>
                        <p className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                          {selectedFeedback.con_strengths || 'No feedback provided'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Weaknesses</Label>
                        <p className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                          {selectedFeedback.con_weaknesses || 'No feedback provided'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Judge & Other Feedback */}
                  <div>
                    <h3 className="font-semibold mb-3">Judge & Other Feedback</h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-muted-foreground">Judge Balance</Label>
                        <p className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                          {selectedFeedback.judge_balance || 'No feedback provided'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Observed Behavior</Label>
                        <p className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                          {selectedFeedback.observed_behavior || 'No feedback provided'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Suggestions</Label>
                        <p className="mt-1 p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                          {selectedFeedback.suggestions || 'No suggestions provided'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Prompt Versions</CardTitle>
                <CardDescription>Manage and track prompt changes</CardDescription>
              </div>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Export History
              </Button>
            </CardHeader>
            <CardContent>
              {promptsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-muted-foreground">Loading prompts...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead>Change Notes</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prompts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No prompt versions found. Prompt versioning is not yet implemented.
                        </TableCell>
                      </TableRow>
                    ) : (
                      prompts.map((prompt) => (
                        <TableRow key={prompt.id}>
                          <TableCell className="capitalize font-medium">{prompt.prompt_type}</TableCell>
                          <TableCell>v{prompt.version}</TableCell>
                          <TableCell>
                            <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                              {prompt.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block max-w-[320px] truncate text-muted-foreground">
                                    {prompt.prompt_name || prompt.prompt_type || 'Prompt'}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[480px] whitespace-pre-wrap">
                                  {prompt.prompt_content || prompt.content || 'No content'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{prompt.change_notes}</TableCell>
                          <TableCell>{new Date(prompt.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPrompt(prompt);
                                setIsPromptOpen(true);
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
      </Card>
      <Dialog open={isPromptOpen} onOpenChange={setIsPromptOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedPrompt?.prompt_name || selectedPrompt?.prompt_type || 'Prompt'}</DialogTitle>
            <DialogDescription>
              {selectedPrompt?.prompt_type} v{selectedPrompt?.version}
              {selectedPrompt?.is_active ? ' (Active)' : ''}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] rounded-md border p-4">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
              {selectedPrompt?.prompt_content || selectedPrompt?.content || 'No content'}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </TabsContent>

        {/* Experiments Tab */}
        <TabsContent value="experiments" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Experiments</CardDescription>
                <CardTitle className="text-2xl">
                  {experimentStats?.total_experiments || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Review</CardDescription>
                <CardTitle className="text-2xl text-yellow-600">
                  {experimentStats?.pending || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Approved</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {experimentStats?.approved || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Improvements Found</CardDescription>
                <CardTitle className="text-2xl text-blue-600">
                  {experimentStats?.improvements_found || 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Experiments Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Prompt Experiments</CardTitle>
                  <CardDescription>
                    Review and approve prompt modifications submitted by users
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadExperiments}
                  disabled={experimentsLoading}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", experimentsLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filter */}
              <div className="mb-4">
                <Select value={experimentStatusFilter} onValueChange={setExperimentStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Experiments Table */}
              {experimentsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : experiments.length === 0 ? (
                <div className="border rounded-lg p-8 text-center text-muted-foreground">
                  <Wand2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Experiments Yet</h3>
                  <p className="text-sm">
                    Experiments will appear here when users re-evaluate documents with custom prompts.
                  </p>
                </div>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Prompt Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Scores</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {experiments.map((exp: any) => (
                        <TableRow key={exp.experiment_id}>
                          <TableCell className="font-mono text-xs">
                            {exp.doc_id.substring(0, 12)}...
                          </TableCell>
                          <TableCell className="text-sm">{exp.user_email}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {exp.prompt_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(exp.experiment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {exp.is_improvement === 1 ? (
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Improved
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  No Change
                                </Badge>
                              )}
                              {exp.score_delta_pro !== 0 && (
                                <span className={cn(
                                  "text-xs font-mono",
                                  exp.score_delta_pro > 0 ? "text-green-600" : "text-red-600"
                                )}>
                                  {exp.score_delta_pro > 0 ? "+" : ""}{exp.score_delta_pro.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                exp.status === 'approved' ? 'default' :
                                exp.status === 'rejected' ? 'destructive' :
                                'secondary'
                              }
                              className="capitalize"
                            >
                              {exp.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedExperiment(exp);
                                setIsExperimentOpen(true);
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Experiment Details Dialog */}
        <Dialog open={isExperimentOpen} onOpenChange={setIsExperimentOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Experiment Details</DialogTitle>
              <DialogDescription>
                Experiment ID: {selectedExperiment?.experiment_id}
              </DialogDescription>
            </DialogHeader>

            {selectedExperiment && (
              <div className="space-y-6">
                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">User:</span>
                    <span className="ml-2 font-medium">{selectedExperiment.user_email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prompt Type:</span>
                    <Badge variant="outline" className="ml-2 capitalize">
                      {selectedExperiment.prompt_type}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <span className="ml-2">{new Date(selectedExperiment.experiment_date).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge
                      variant={
                        selectedExperiment.status === 'approved' ? 'default' :
                        selectedExperiment.status === 'rejected' ? 'destructive' :
                        'secondary'
                      }
                      className="ml-2 capitalize"
                    >
                      {selectedExperiment.status}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Score Comparison */}
                <div>
                  <h3 className="font-semibold mb-3">Score Comparison</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Before (Original)</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Pro Score:</span>
                          <span className="font-mono">{(selectedExperiment.avg_pro_score - selectedExperiment.score_delta_pro).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Con Score:</span>
                          <span className="font-mono">{(selectedExperiment.avg_con_score - selectedExperiment.score_delta_con).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Difference:</span>
                          <span className="font-mono">{((selectedExperiment.avg_pro_score - selectedExperiment.score_delta_pro) - (selectedExperiment.avg_con_score - selectedExperiment.score_delta_con)).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">After (Experiment)</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Pro Score:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{selectedExperiment.avg_pro_score.toFixed(2)}</span>
                            {selectedExperiment.score_delta_pro !== 0 && (
                              <span className={selectedExperiment.score_delta_pro > 0 ? "text-green-600" : "text-red-600"}>
                                {selectedExperiment.score_delta_pro > 0 ? "▲" : "▼"} {Math.abs(selectedExperiment.score_delta_pro).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>Con Score:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{selectedExperiment.avg_con_score.toFixed(2)}</span>
                            {selectedExperiment.score_delta_con !== 0 && (
                              <span className={selectedExperiment.score_delta_con > 0 ? "text-green-600" : "text-red-600"}>
                                {selectedExperiment.score_delta_con > 0 ? "▲" : "▼"} {Math.abs(selectedExperiment.score_delta_con).toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span>Difference:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{selectedExperiment.score_difference.toFixed(2)}</span>
                            {selectedExperiment.decisiveness_delta !== 0 && (
                              <span className={selectedExperiment.decisiveness_delta > 0 ? "text-green-600" : "text-red-600"}>
                                {selectedExperiment.decisiveness_delta > 0 ? "More" : "Less"} Decisive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {selectedExperiment.is_improvement === 1 && (
                    <Alert className="mt-4">
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Improvement Detected</AlertTitle>
                      <AlertDescription>
                        This experiment shows measurable improvements in evaluation metrics.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <Separator />

                {/* Prompt Content */}
                <div>
                  <h3 className="font-semibold mb-3">Custom Prompt</h3>
                  <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted/50">
                    <pre className="text-xs whitespace-pre-wrap">
                      {selectedExperiment.prompt_content}
                    </pre>
                  </ScrollArea>
                </div>

                {/* Admin Actions */}
                {selectedExperiment.status === 'pending' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="font-semibold">Admin Actions</h3>

                      {/* Approve Section */}
                      <div className="space-y-3">
                        <Label>Approve Experiment</Label>
                        <div className="space-y-2">
                          <Input
                            placeholder="Optional approval notes..."
                            value={approveNotes}
                            onChange={(e) => setApproveNotes(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApproveExperiment(selectedExperiment.experiment_id, 'set_default')}
                              className="flex-1"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Approve & Set as Default
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => handleApproveExperiment(selectedExperiment.experiment_id, 're_evaluate_all')}
                                    variant="outline"
                                    className="flex-1"
                                  >
                                    <Activity className="h-4 w-4 mr-2" />
                                    Approve & Re-evaluate All
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Set as default and queue batch re-evaluation</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>

                      {/* Reject Section */}
                      <div className="space-y-3">
                        <Label>Reject Experiment</Label>
                        <div className="space-y-2">
                          <Input
                            placeholder="Rejection reason (required)..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                          />
                          <Button
                            onClick={() => handleRejectExperiment(selectedExperiment.experiment_id)}
                            variant="destructive"
                            className="w-full"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject Experiment
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Show approval/rejection info if already processed */}
                {selectedExperiment.status !== 'pending' && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="font-semibold">
                        {selectedExperiment.status === 'approved' ? 'Approval' : 'Rejection'} Information
                      </h3>
                      <div className="text-sm space-y-1">
                        <div>
                          <span className="text-muted-foreground">By:</span>
                          <span className="ml-2">{selectedExperiment.approved_by || 'Unknown'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Date:</span>
                          <span className="ml-2">
                            {selectedExperiment.approved_at ? new Date(selectedExperiment.approved_at).toLocaleString() : 'Unknown'}
                          </span>
                        </div>
                        {selectedExperiment.notes && (
                          <div>
                            <span className="text-muted-foreground">Notes:</span>
                            <p className="mt-1 p-2 bg-muted rounded text-sm">{selectedExperiment.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user accounts and permissions</CardDescription>
              </div>
              <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>Add a new user to the system</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Email</Label>
                      <Input
                        className="mt-1"
                        placeholder="user@example.com"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        className="mt-1"
                        type="password"
                        placeholder="••••••••"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleCreateUser} disabled={!newUser.email || !newUser.password}>
                      Create User
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Loading users...</p>
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p className="text-sm text-muted-foreground">No users found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.user_id || user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'default' : 'secondary'}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">Edit</Button>
                            <Button variant="ghost" size="sm" title="Reset password">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Management Tab */}
        <TabsContent value="data" className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Danger Zone</AlertTitle>
            <AlertDescription>
              Actions in this section are destructive and cannot be undone. Please proceed with caution.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Delete Single Document
                </CardTitle>
                <CardDescription>Remove a specific document and its results</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Document ID</Label>
                  <Input className="mt-1" placeholder="Enter document ID" />
                </div>
                <div>
                  <Label>Type document title to confirm</Label>
                  <Input className="mt-1" placeholder="Document title" />
                </div>
                <Button variant="destructive" className="w-full">Delete Document</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Bulk Operations
                </CardTitle>
                <CardDescription>Mass data management actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete All Documents
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete All Documents</DialogTitle>
                      <DialogDescription>
                        This will permanently delete all documents and their evaluation results.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Type "DELETE ALL DOCUMENTS" to confirm</Label>
                      <Input 
                        className="mt-2" 
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        disabled={deleteConfirm !== 'DELETE ALL DOCUMENTS'}
                        onClick={handleDeleteAllDocuments}
                      >
                        Delete All
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Delete All Feedback
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete All Feedback</DialogTitle>
                      <DialogDescription>
                        This will permanently delete all feedback records.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="destructive" onClick={handleDeleteAllFeedback}>
                        Confirm Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertTitle>Delete All Logs</AlertTitle>
                  <AlertDescription>
                    Log management is handled by the backend. Logs are automatically rotated and managed.
                  </AlertDescription>
                </Alert>

                <Separator />

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Shield className="h-4 w-4" />
                      Reset Auth Database
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset Auth Database</DialogTitle>
                      <DialogDescription>
                        This will delete all users except the default admin. You will need to recreate all user accounts.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="destructive" onClick={handleResetAuthDatabase}>
                        Confirm Reset
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" className="w-full justify-start gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Nuclear Delete (Everything)
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nuclear Delete - Delete Everything</DialogTitle>
                      <DialogDescription>
                        This will permanently delete ALL data: documents, feedback, results, and reset the auth database.
                        This action is IRREVERSIBLE!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>Type "NUCLEAR DELETE" to confirm</Label>
                      <Input
                        className="mt-2"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        disabled={deleteConfirm !== 'NUCLEAR DELETE'}
                        onClick={handleNuclearDelete}
                      >
                        Nuclear Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
