import { useEffect, useState } from "react";
import { PipelineStage } from "@/types";
import { cn } from "@/lib/utils";
import { Loader2, Circle, AlertCircle } from "lucide-react";

/** Animated completed checkpointer: circle pops in, then white checkmark draws. Uses theme primary (teal green) to match stage labels. */
function CheckpointComplete() {
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimate(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 bg-primary"
      style={{
        animation: animate
          ? "checkpoint-circle-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
          : undefined,
        opacity: 1,
        transform: "scale(1)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 text-primary-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M5 12l5 5 9-14"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={animate ? 1 : 0}
          style={{
            animation: animate
              ? "checkpoint-draw 0.25s ease-out 0.15s forwards"
              : undefined,
          }}
        />
      </svg>
    </div>
  );
}

/** Vertical line that draws from one stage to the next when the previous stage is completed. Centered in the row for balanced layout; smooth eased animation. */
function ConnectorLine({ isAnimated }: { isAnimated: boolean }) {
  return (
    <div className="flex h-6 w-full flex-shrink-0 items-center justify-center px-3">
      <svg
        viewBox="0 0 2 24"
        className="h-6 w-0.5 min-w-[2px] text-primary"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path
          d="M1 0 v24"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          style={
            isAnimated
              ? {
                  animation:
                    "connector-draw 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards",
                }
              : undefined
          }
        />
      </svg>
    </div>
  );
}

export default function PipelineProgress({
  stages,
  currentStage,
  elapsedTime,
}: PipelineProgressProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Processing Pipeline</h3>
        <span className="text-sm text-muted-foreground font-mono">
          Elapsed: {formatTime(elapsedTime)}
        </span>
      </div>

      <div className="space-y-0">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex flex-col">
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all",
                stage.status === "running" &&
                  "bg-primary/10 border border-primary/30",
                stage.status === "completed" && "bg-accent/50",
                stage.status === "error" &&
                  "bg-destructive/10 border border-destructive/30",
                stage.status === "pending" && "opacity-50"
              )}
            >
              <div className="flex-shrink-0">
                {stage.status === "completed" && <CheckpointComplete />}
                {stage.status === "running" && (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                )}
                {stage.status === "pending" && (
                  <Circle className="h-6 w-6 text-muted-foreground" />
                )}
                {stage.status === "error" && (
                  <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-destructive-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <p
                  className={cn(
                    "font-medium",
                    stage.status === "running" && "text-primary",
                    stage.status === "error" && "text-destructive"
                  )}
                >
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
            {index < stages.length - 1 && (
              <ConnectorLine isAnimated={stage.status === "completed"} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
