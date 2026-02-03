/**
 * React hook for consuming Server-Sent Events (SSE) from pipeline execution
 * Uses @microsoft/fetch-event-source for proper header support
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { PipelineStage } from "@/types";

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/api/v1")) return trimmed;
  return `${trimmed}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"
);

const INITIAL_STAGES: PipelineStage[] = [
  { id: "1", name: "Initialization", status: "pending" },
  { id: "2", name: "Document Ingestion (LightRAG)", status: "pending" },
  { id: "3", name: "Metadata Extraction", status: "pending" },
  { id: "4", name: "RAG Context Retrieval", status: "pending" },
  { id: "5", name: "Agent Debate", status: "pending" },
  { id: "6", name: "Judge Panel Evaluation", status: "pending" },
  { id: "7", name: "PDF Report Generation", status: "pending" },
  { id: "8", name: "Saving Results", status: "pending" },
];

// Custom error class to signal we should stop retrying
class FatalError extends Error {}

export function usePipelineStream(jobId: string | null) {
  const [stages, setStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [currentStage, setCurrentStage] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const isCompleteRef = useRef(false);
  const currentStageRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasErrorRef = useRef(false);

  const resetState = useCallback(() => {
    setStages(INITIAL_STAGES);
    setCurrentStage(0);
    setIsComplete(false);
    isCompleteRef.current = false;
    currentStageRef.current = 0;
    setError(null);
    hasErrorRef.current = false;
    setResult(null);
  }, []);

  useEffect(() => {
    if (!jobId) {
      resetState();
      return;
    }

    const token = localStorage.getItem("cgsai_token");
    if (!token) {
      setError("Authentication required");
      return;
    }

    // Create abort controller for cleanup
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const url = `${API_BASE_URL}/evaluation/pipeline/${jobId}/stream`;

    const startStream = async () => {
      try {
        await fetchEventSource(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal: abortController.signal,
          // Keep connection open even when tab is hidden (prevents reconnection on tab switch)
          openWhenHidden: true,

          onopen: async (response) => {
            if (response.ok) {
              return;
            }

            if (response.status === 401 || response.status === 403) {
              throw new FatalError("Authentication failed");
            }

            if (response.status === 404) {
              throw new FatalError(`Job not found: ${jobId}`);
            }

            throw new Error(`Server error: ${response.status}`);
          },

          onmessage: (event) => {
            // Skip heartbeats and empty events
            if (!event.data || event.data.startsWith(":")) {
              return;
            }

            try {
              const data = JSON.parse(event.data);
              const eventType = event.event || data.event;

              switch (eventType) {
                case "stage_update": {
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
                            ? "completed"
                            : idx + 1 === stage.number
                            ? stage.status === "completed"
                              ? "completed"
                              : "running"
                            : "pending",
                      }))
                    );
                  }
                  break;
                }

                case "complete": {
                  setIsComplete(true);
                  isCompleteRef.current = true;

                  if (data.result) {
                    setResult(data.result);
                  }

                  // Mark all stages as completed
                  setStages((prev) =>
                    prev.map((s) => ({ ...s, status: "completed" }))
                  );

                  // Abort to close the connection cleanly
                  abortController.abort();
                  break;
                }

                case "pipeline_error": {
                  setError(data.error || "Pipeline failed");
                  hasErrorRef.current = true;

                  // Mark current stage as error
                  setStages((prev) =>
                    prev.map((s, idx) =>
                      idx + 1 === currentStageRef.current
                        ? { ...s, status: "error" }
                        : s
                    )
                  );

                  // Abort to close the connection
                  abortController.abort();
                  break;
                }

                default:
                  break;
              }
            } catch {
              // Ignore parse errors for malformed events
            }
          },

          onerror: (err) => {
            // Don't retry if we've completed or if the error is fatal
            if (isCompleteRef.current) {
              throw new FatalError("Pipeline complete, stopping reconnection");
            }

            if (hasErrorRef.current) {
              throw new FatalError("Pipeline errored, stopping reconnection");
            }

            if (err instanceof FatalError) {
              setError(err.message);
              hasErrorRef.current = true;
              throw err; // Stop retrying
            }

            // Return undefined to allow fetch-event-source to retry
          },

          onclose: () => {},
        });
      } catch (err) {
        if (err instanceof FatalError) {
          // Expected stop
        } else if (err instanceof DOMException && err.name === "AbortError") {
          // Expected abort on cleanup
        } else if (!isCompleteRef.current && !hasErrorRef.current) {
          setError(err instanceof Error ? err.message : "Connection failed");
          hasErrorRef.current = true;
        }
      }
    };

    startStream();

    // Cleanup on unmount or jobId change
    return () => {
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, [jobId, resetState]);

  return { stages, currentStage, isComplete, error, result };
}
