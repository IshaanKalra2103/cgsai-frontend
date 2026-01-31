/**
 * React hook for polling pipeline status via REST API
 * Replaces SSE-based usePipelineStream for more reliable progress tracking
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { PipelineStage } from '@/types';

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  return `${trimmed}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
);

const POLL_INTERVAL = 2000; // Poll every 2 seconds

const INITIAL_STAGES: PipelineStage[] = [
  { id: '1', name: 'Initialization', status: 'pending' },
  { id: '2', name: 'Document Processing', status: 'pending' },
  { id: '3', name: 'Debate & Evaluation', status: 'pending' },
  { id: '4', name: 'Report Generation', status: 'pending' },
];

// Map backend stages (1-8) to frontend stages (1-4)
const BACKEND_TO_FRONTEND_STAGE: Record<number, number> = {
  0: 0,  // Queued
  1: 1,  // Initialization -> Initialization
  2: 2,  // Document Ingestion -> Document Processing
  3: 2,  // Metadata Extraction -> Document Processing
  4: 3,  // RAG Context Retrieval -> Debate & Evaluation
  5: 3,  // Agent Debate -> Debate & Evaluation
  6: 3,  // Judge Panel Evaluation -> Debate & Evaluation
  7: 4,  // PDF Report Generation -> Report Generation
  8: 4,  // Saving Results -> Report Generation
};

interface PipelineStatusResponse {
  job_id: string;
  doc_id: string;
  status: string;
  current_stage: number;
  stage_name: string;
  total_stages: number;
  error?: string;
  result?: any;
}

export function usePipelinePolling(jobId: string | null) {
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [currentStage, setCurrentStage] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const isPollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const fetchStatus = useCallback(async (token: string): Promise<PipelineStatusResponse | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/evaluation/status/${jobId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`API error: ${response.status}`);
      }

      return response.json();
    } catch (err) {
      console.error('[Polling] Error fetching status:', err);
      return null;
    }
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      // Reset state when jobId is null
      setStages(INITIAL_STAGES);
      setCurrentStage(0);
      setIsComplete(false);
      setError(null);
      setResult(null);
      stopPolling();
      return;
    }

    const token = localStorage.getItem('cgsai_token');
    if (!token) {
      console.error('No auth token found');
      setError('Authentication required');
      return;
    }

    // Start polling
    const poll = async () => {
      if (!isPollingRef.current) return;

      const data = await fetchStatus(token);
      if (!data) {
        return;
      }

      // Map backend stage to frontend stage
      const frontendStage = BACKEND_TO_FRONTEND_STAGE[data.current_stage] || 0;
      console.log('[Polling] Status:', data.status, 'Backend stage:', data.current_stage, '-> Frontend stage:', frontendStage);

      // Update current stage (using frontend mapping)
      setCurrentStage(frontendStage);

      // Update stages based on current progress (using frontend stages)
      setStages((prev) =>
        prev.map((s, idx) => ({
          ...s,
          status:
            data.status === 'failed' && idx + 1 === frontendStage
              ? 'error'
              : idx + 1 < frontendStage
              ? 'completed'
              : idx + 1 === frontendStage
              ? data.status === 'completed' ? 'completed' : 'running'
              : 'pending',
        }))
      );

      // Handle completion
      if (data.status === 'completed') {
        console.log('[Polling] Pipeline completed, result:', data.result);
        setIsComplete(true);
        setResult(data.result);
        // Mark all stages as completed
        setStages((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
        stopPolling();
        return;
      }

      // Handle failure
      if (data.status === 'failed') {
        console.log('[Polling] Pipeline failed:', data.error);
        setError(data.error || 'Pipeline failed');
        stopPolling();
        return;
      }
    };

    // Initial poll
    isPollingRef.current = true;
    poll();

    // Start interval
    pollTimerRef.current = window.setInterval(poll, POLL_INTERVAL);

    return () => {
      stopPolling();
    };
  }, [jobId, fetchStatus, stopPolling]);

  return { stages, currentStage, isComplete, error, result };
}
