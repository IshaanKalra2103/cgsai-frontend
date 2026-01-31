/**
 * React hook for consuming Server-Sent Events (SSE) from pipeline execution
 */

import { useState, useEffect, useRef } from 'react';
import { PipelineStage } from '@/types';

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  return `${trimmed}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
);

const INITIAL_STAGES: PipelineStage[] = [
  { id: '1', name: 'Initialization', status: 'pending' },
  { id: '2', name: 'Document Ingestion (LightRAG)', status: 'pending' },
  { id: '3', name: 'Metadata Extraction', status: 'pending' },
  { id: '4', name: 'RAG Context Retrieval', status: 'pending' },
  { id: '5', name: 'Agent Debate', status: 'pending' },
  { id: '6', name: 'Judge Panel Evaluation', status: 'pending' },
  { id: '7', name: 'PDF Report Generation', status: 'pending' },
  { id: '8', name: 'Saving Results', status: 'pending' },
];

export function usePipelineStream(jobId: string | null) {
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [currentStage, setCurrentStage] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const isCompleteRef = useRef(false);
  const currentStageRef = useRef(0);
  const pollTimerRef = useRef<number | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!jobId) {
      // Reset state when jobId is null
      setStages(INITIAL_STAGES);
      setCurrentStage(0);
      setIsComplete(false);
      isCompleteRef.current = false;
      currentStageRef.current = 0;
      setError(null);
      setResult(null);
      lastEventTimeRef.current = Date.now();
      return;
    }

    const token = localStorage.getItem('cgsai_token');
    if (!token) {
      console.error('No auth token found');
      setError('Authentication required');
      return;
    }

    // EventSource doesn't support custom headers, so we pass token as query parameter
    const url = `${API_BASE_URL}/evaluation/pipeline/${jobId}/stream?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(url);
    const fetchResults = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/evaluation/results/${jobId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          return null;
        }

        return response.json();
      } catch (err) {
        return null;
      }
    };

    eventSource.addEventListener('stage_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] stage_update:', data);
        lastEventTimeRef.current = Date.now();
        const stage = data.stage;
        const progress = data.progress;

        if (stage && progress) {
          setCurrentStage(stage.number);
          currentStageRef.current = stage.number;

          setStages((prev) =>
            prev.map((s, idx) => ({
              ...s,
              status:
                idx + 1 < stage.number
                  ? 'completed'
                  : idx + 1 === stage.number
                  ? stage.status === 'completed'
                    ? 'completed'
                    : 'running'
                  : 'pending',
            }))
          );
        }
      } catch (err) {
        console.error('Error parsing stage_update event:', err);
      }
    });

    eventSource.addEventListener('complete', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[SSE] complete:', data);
        setIsComplete(true);
        isCompleteRef.current = true;
        if (data.result) {
          console.log('[SSE] Setting result:', data.result);
          setResult(data.result);
        } else {
          console.warn('[SSE] Complete event has no result data');
        }
        // Mark all stages as completed
        setStages((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
        eventSource.close();
      } catch (err) {
        console.error('Error parsing complete event:', err, event);
      }
    });

    eventSource.addEventListener('pipeline_error', (event: any) => {
      try {
        const data = JSON.parse(event.data);
        setError(data.error || 'Pipeline failed');
        // Mark current stage as error
        setStages((prev) =>
          prev.map((s, idx) =>
            idx + 1 === currentStageRef.current ? { ...s, status: 'error' } : s
          )
        );
        eventSource.close();
      } catch (err) {
        console.error('Error parsing pipeline_error event:', err);
        setError('Pipeline error');
        eventSource.close();
      }
    });

    const startPolling = () => {
      if (pollTimerRef.current) {
        return;
      }
      pollTimerRef.current = window.setInterval(async () => {
        const data = await fetchResults();
        if (!data) {
          return;
        }

        if (data.status === 'completed') {
          setIsComplete(true);
          isCompleteRef.current = true;
          if (data.evaluation || data.metadata || data.debate) {
            setResult(data);
          }
          setStages((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
          if (pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        } else if (data.status === 'failed') {
          setError(data.detail || 'Pipeline failed');
          if (pollTimerRef.current) {
            window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      }, 3000);
    };

    // Periodic check: if no events received in 30 seconds, start polling
    const stallenessCheckInterval = setInterval(() => {
      if (isCompleteRef.current) {
        clearInterval(stallenessCheckInterval);
        return;
      }

      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      if (timeSinceLastEvent > 30000) { // 30 seconds without events
        console.log('[SSE] No events for 30s, starting fallback polling');
        startPolling();
        clearInterval(stallenessCheckInterval);
      }
    }, 10000); // Check every 10 seconds

    eventSource.onerror = (event) => {
      // EventSource fires "error" on normal close as well; ignore closed streams.
      if (eventSource.readyState === EventSource.CLOSED) {
        return;
      }
      if (isCompleteRef.current) {
        return;
      }
      // Connection-level error; allow EventSource to retry while we poll as fallback.
      console.error('SSE connection error', event);

      fetchResults().then((data) => {
        if (!data) {
          startPolling();
          return;
        }

        if (data.status === 'completed') {
          setIsComplete(true);
          isCompleteRef.current = true;
          if (data.evaluation || data.metadata || data.debate) {
            setResult(data);
          }
          setStages((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
        } else if (data.status === 'failed') {
          setError(data.detail || 'Pipeline failed');
        } else {
          startPolling();
        }
      });
    };

    return () => {
      eventSource.close();
      clearInterval(stallenessCheckInterval);
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [jobId]);

  return { stages, currentStage, isComplete, error, result };
}
