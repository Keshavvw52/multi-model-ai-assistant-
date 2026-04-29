'use client';

interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
}

export function StreamingText({ text, isStreaming }: StreamingTextProps) {
  return (
    <span className="whitespace-pre-wrap break-words">
      {text}
      {isStreaming && (
        <span
          className="inline-block w-0.5 h-4 ml-0.5 bg-accent align-middle animate-pulse-soft"
        />
      )}
    </span>
  );
}
