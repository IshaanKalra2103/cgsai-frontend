import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface EvaluationState {
  jobId: string | null;
  isProcessing: boolean;
  elapsedTime: number;
  evaluationResult: any | null;
  startedAt: number | null;
}

interface EvaluationContextType {
  state: EvaluationState;
  startEvaluation: (jobId: string) => void;
  setResult: (result: any) => void;
  clearEvaluation: () => void;
  setProcessing: (processing: boolean) => void;
}

const EvaluationContext = createContext<EvaluationContextType | undefined>(undefined);

const STORAGE_KEY = 'cgsai_evaluation';

const initialState: EvaluationState = {
  jobId: null,
  isProcessing: false,
  elapsedTime: 0,
  evaluationResult: null,
  startedAt: null,
};

export function EvaluationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EvaluationState>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          elapsedTime: parsed.startedAt && parsed.isProcessing
            ? Math.floor((Date.now() - parsed.startedAt) / 1000)
            : parsed.elapsedTime || 0,
        };
      }
    } catch (e) {
      console.warn('Failed to load evaluation state from sessionStorage:', e);
    }
    return initialState;
  });

  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state.isProcessing && state.startedAt) {
      interval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedTime: Math.floor((Date.now() - (prev.startedAt || Date.now())) / 1000),
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.isProcessing, state.startedAt]);

  // Persist to sessionStorage
  useEffect(() => {
    try {
      if (state.jobId || state.isProcessing || state.evaluationResult) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Failed to save evaluation state to sessionStorage:', e);
    }
  }, [state]);

  const startEvaluation = (jobId: string) => {
    setState({
      jobId,
      isProcessing: true,
      elapsedTime: 0,
      evaluationResult: null,
      startedAt: Date.now(),
    });
  };

  const setResult = (result: any) => {
    setState((prev) => ({
      ...prev,
      isProcessing: false,
      evaluationResult: result,
    }));
  };

  const clearEvaluation = () => {
    setState(initialState);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear evaluation state from sessionStorage:', e);
    }
  };

  const setProcessing = (processing: boolean) => {
    setState((prev) => ({
      ...prev,
      isProcessing: processing,
      ...(processing ? {} : { startedAt: null }),
    }));
  };

  return (
    <EvaluationContext.Provider
      value={{ state, startEvaluation, setResult, clearEvaluation, setProcessing }}
    >
      {children}
    </EvaluationContext.Provider>
  );
}

export function useEvaluation() {
  const context = useContext(EvaluationContext);
  if (!context) {
    throw new Error('useEvaluation must be used within EvaluationProvider');
  }
  return context;
}
