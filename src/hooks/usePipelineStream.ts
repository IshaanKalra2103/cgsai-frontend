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
    console.log("[SSE] useEffect triggered, jobId:", jobId);

    if (!jobId) {
      console.log("[SSE] No jobId, resetting state");
      resetState();
      return;
    }

    const token = localStorage.getItem("cgsai_token");
    if (!token) {
      console.error("[SSE] No auth token found");
      setError("Authentication required");
      return;
    }

    console.log("[SSE] Starting stream for job:", jobId);

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
              console.log("[SSE] Connection opened");
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
            // Debug: log all incoming events
            console.log("[SSE] Raw event received:", {
              event: event.event,
              data: event.data?.substring(0, 100),
              id: event.id,
            });

            // Skip heartbeats and empty events
            // Heartbeats come through as comments (": heartbeat") or empty event types
            if (!event.data || event.data.startsWith(":")) {
              console.log("[SSE] Skipping heartbeat/empty event");
              return;
            }

            // If no event type, try to parse and handle anyway
            if (!event.event) {
              console.log("[SSE] Event has no type, attempting to parse data");
            }

            try {
              const data = JSON.parse(event.data);
              const eventType = event.event || data.event; // Fallback to data.event if event.event is empty

              console.log("[SSE] Parsed event:", { type: eventType, data });

              switch (eventType) {
                case "stage_update": {
                  console.log("[SSE] Processing stage_update:", data);
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
                  console.log("[SSE] complete:", data);
                  setIsComplete(true);
                  isCompleteRef.current = true;

                  if (data.result) {
                    console.log("[SSE] Setting result:", data.result);
                    setResult(data.result);
                  } else {
                    console.warn("[SSE] Complete event has no result data");
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
                  console.error("[SSE] pipeline_error:", data);
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
                  console.log(
                    "[SSE] Unknown event type:",
                    eventType,
                    "data:",
                    data
                  );
              }
            } catch (err) {
              console.error("[SSE] Error parsing event data:", err, event);
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

            // Log and let fetch-event-source retry
            console.error("[SSE] Connection error, will retry:", err);
            // Return undefined to allow retry with default backoff
          },

          onclose: () => {
            console.log("[SSE] Connection closed");
            // If we're not complete and no error, this might be unexpected
            if (!isCompleteRef.current && !hasErrorRef.current) {
              console.warn("[SSE] Connection closed unexpectedly");
            }
          },
        });
      } catch (err) {
        // Handle fatal errors or aborted requests
        if (err instanceof FatalError) {
          console.log("[SSE] Stream stopped:", err.message);
        } else if (err instanceof DOMException && err.name === "AbortError") {
          console.log("[SSE] Stream aborted");
        } else {
          console.error("[SSE] Unexpected error:", err);
          if (!isCompleteRef.current && !hasErrorRef.current) {
            setError(err instanceof Error ? err.message : "Connection failed");
            hasErrorRef.current = true;
          }
        }
      }
    };

    startStream();

    // Cleanup on unmount or jobId change
    return () => {
      console.log("[SSE] Cleaning up stream");
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, [jobId, resetState]);

  return { stages, currentStage, isComplete, error, result };
}
