import { PipelineStage } from '@/types';
import { cn } from '@/lib/utils';
import { Check, Loader2, Circle, AlertCircle } from 'lucide-react';

interface PipelineProgressProps {
  stages: PipelineStage[];
  currentStage: number;
  elapsedTime: number;
}

export default function PipelineProgress({ stages, currentStage, elapsedTime }: PipelineProgressProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Processing Pipeline</h3>
        <span className="text-sm text-muted-foreground font-mono">
          Elapsed: {formatTime(elapsedTime)}
        </span>
      </div>
      
      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-all",
              stage.status === 'running' && "bg-primary/10 border border-primary/30",
              stage.status === 'completed' && "bg-accent/50",
              stage.status === 'error' && "bg-destructive/10 border border-destructive/30",
              stage.status === 'pending' && "opacity-50"
            )}
          >
            <div className="flex-shrink-0">
              {stage.status === 'completed' && (
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              {stage.status === 'running' && (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              )}
              {stage.status === 'pending' && (
                <Circle className="h-6 w-6 text-muted-foreground" />
              )}
              {stage.status === 'error' && (
                <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
                  <AlertCircle className="h-4 w-4 text-destructive-foreground" />
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <p className={cn(
                "font-medium",
                stage.status === 'running' && "text-primary",
                stage.status === 'error' && "text-destructive"
              )}>
                {stage.name}
              </p>
              {stage.duration && (
                <p className="text-xs text-muted-foreground">
                  Completed in {stage.duration.toFixed(1)}s
                </p>
              )}
            </div>
            
            <span className="text-xs font-mono text-muted-foreground">
              {index + 1}/{stages.length}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
