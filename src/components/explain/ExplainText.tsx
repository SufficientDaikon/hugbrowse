import { glossaryMap, glossaryTermPattern } from "./glossary";
import { Tooltip } from "../ui/Tooltip";
import { Info } from "lucide-react";

interface ExplainTextProps {
  text: string;
  className?: string;
}

export function ExplainText({ text, className }: ExplainTextProps) {
  const parts = text.split(glossaryTermPattern);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const entry = glossaryMap.get(part.toLowerCase());
        if (entry) {
          return (
            <Tooltip
              key={i}
              content={
                <div>
                  <p className="font-semibold text-[var(--foreground)] mb-1">
                    {entry.term}
                  </p>
                  <p className="text-[var(--muted)]">{entry.long}</p>
                </div>
              }
            >
              <span className="underline decoration-dotted decoration-hf-orange/50 underline-offset-2 cursor-help">
                {part}
              </span>
            </Tooltip>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

interface InfoButtonProps {
  term: string;
}

export function InfoButton({ term }: InfoButtonProps) {
  const entry = glossaryMap.get(term.toLowerCase());
  if (!entry) return null;

  return (
    <Tooltip
      content={
        <div>
          <p className="font-semibold text-[var(--foreground)] mb-1">
            {entry.term}
          </p>
          <p className="text-[var(--muted)]">{entry.long}</p>
          {entry.related && entry.related.length > 0 && (
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              Related: {entry.related.join(", ")}
            </p>
          )}
        </div>
      }
    >
      <Info className="inline h-3.5 w-3.5 text-[var(--muted)] hover:text-hf-orange transition-colors" />
    </Tooltip>
  );
}
