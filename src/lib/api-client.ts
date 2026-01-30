/**
 * API client for CGS AI backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: {
    user_id: number;
    email: string;
    role: string;
    is_active: boolean;
  };
}

class APIClient {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('cgsai_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('cgsai_token', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('cgsai_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('cgsai_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      ...options.headers,
    };

    // Add Content-Type for JSON requests (if body is not FormData)
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add Authorization header if token exists
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 Unauthorized - clear token and redirect to login
    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `API Error: ${response.statusText}`);
    }

    return response.json();
  }

  private async requestBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
    const headers: HeadersInit = {
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearToken();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `API Error: ${response.statusText}`);
    }

    return response.blob();
  }

  // ===== Auth endpoints =====
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(response.access_token);
    return response;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    this.clearToken();
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  // ===== Evaluation endpoints =====
  async uploadPaper(formData: FormData) {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/evaluation/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  async startPipeline(jobId: string) {
    return this.request(`/evaluation/start/${jobId}`, { method: 'POST' });
  }

  async getResults(jobId: string) {
    return this.request(`/evaluation/results/${jobId}`);
  }

  async downloadReportPdf(docId: string) {
    return this.requestBlob(`/evaluation/download/${docId}/report`);
  }

  async downloadOriginalPdf(docId: string) {
    return this.requestBlob(`/documents/${docId}/download/original`);
  }

  // ===== Documents endpoints =====
  async getDocuments(params?: { search?: string; relevance_filter?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.relevance_filter) query.append('relevance_filter', params.relevance_filter);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const queryString = query.toString();
    return this.request(`/documents${queryString ? `?${queryString}` : ''}`);
  }

  async getDocument(docId: string) {
    return this.request(`/documents/${docId}`);
  }

  async chatWithDocument(docId: string, message: string, mode: string = 'hybrid') {
    return this.request(`/documents/${docId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, mode }),
    });
  }

  async submitFeedback(docId: string, feedback: any) {
    return this.request(`/documents/${docId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
  }

  async getDocumentEvaluation(docId: string) {
    return this.request(`/documents/${docId}/evaluation`);
  }

  async getPrompts() {
    return this.request(`/documents/prompts`);
  }

  async updatePrompt(promptType: string, content: string) {
    return this.request(`/documents/prompts/${promptType}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async reEvaluateDocument(docId: string, promptType: string, promptContent: string, question?: string) {
    return this.request(`/documents/${docId}/re-evaluate`, {
      method: 'POST',
      body: JSON.stringify({
        prompt_type: promptType,
        prompt_content: promptContent,
        question,
      }),
    });
  }

  async reEvaluateDocumentMultiPrompt(docId: string, prompts: {
    pro?: string;
    con?: string;
    judge?: string;
  }, question?: string) {
    return this.request(`/documents/${docId}/re-evaluate-multi`, {
      method: 'POST',
      body: JSON.stringify({
        prompts,
        question,
      }),
    });
  }

  // ===== Admin endpoints =====
  async getUsers() {
    return this.request('/admin/users');
  }

  async createUser(userData: { email: string; password: string; role: string }) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: number, updates: { role?: string; is_active?: boolean }) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deactivateUser(userId: number) {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getStatistics() {
    return this.request('/admin/statistics');
  }

  async getLoginAttempts(limit: number = 100) {
    return this.request(`/admin/login_attempts?limit=${limit}`);
  }

  async getFeedback(limit: number = 100) {
    return this.request(`/admin/feedback?limit=${limit}`);
  }

  async getAdminPrompts() {
    return this.request('/admin/prompts');
  }

  async deleteAllDocuments() {
    return this.request('/admin/documents/all', { method: 'DELETE' });
  }

  async deleteAllFeedback() {
    return this.request('/admin/feedback/all', { method: 'DELETE' });
  }

  async resetAuthDatabase() {
    return this.request('/admin/auth/reset', { method: 'DELETE' });
  }

  async nuclearDelete() {
    return this.request('/admin/nuclear', { method: 'DELETE' });
  }

  // ===== Experiment endpoints =====
  async getExperiments(params?: { status?: string; user_email?: string; sort_by?: string }) {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.user_email) query.append('user_email', params.user_email);
    if (params?.sort_by) query.append('sort_by', params.sort_by);

    const queryString = query.toString();
    return this.request(`/admin/experiments${queryString ? `?${queryString}` : ''}`);
  }

  async getExperiment(experimentId: string) {
    return this.request(`/admin/experiments/${experimentId}`);
  }

  async approveExperiment(experimentId: string, action: 'set_default' | 're_evaluate_all', notes?: string) {
    return this.request(`/admin/experiments/${experimentId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, notes }),
    });
  }

  async rejectExperiment(experimentId: string, reason: string) {
    return this.request(`/admin/experiments/${experimentId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ===== Scoring Config endpoints =====
  async getScoringConfig() {
    return this.request('/admin/scoring-config');
  }

  async updateScoringConfig(config: {
    confident_relevance_score?: number;
    borderline_score?: number;
    paper_relevance_threshold?: number;
    borderline_combined_threshold?: number;
  }) {
    return this.request('/admin/scoring-config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  async resetScoringConfig() {
    return this.request('/admin/scoring-config/reset', {
      method: 'POST',
    });
  }
}

export const apiClient = new APIClient();
