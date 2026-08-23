"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  HelpCircle,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentQaProps {
  text: string;
}

type QaStatus = "idle" | "loading" | "success" | "error";

interface ConversationEntry {
  id: number;
  question: string;
  answer?: string;
}

export function DocumentQa({ text }: DocumentQaProps) {
  const [questionsStatus, setQuestionsStatus] = useState<QaStatus>("idle");
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<Set<string>>(
    () => new Set()
  );

  const [inputValue, setInputValue] = useState("");
  const [answerStatus, setAnswerStatus] = useState<QaStatus>("idle");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextIdRef = useRef(1);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  const loadQuestions = useCallback(async () => {
    setQuestionsStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/qa/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setQuestionsStatus("error");
        setErrorMessage(
          payload?.error?.message ??
            "Could not load suggested questions."
        );
        return;
      }

      setSuggestedQuestions(payload.data.questions as string[]);
      setQuestionsStatus("success");
    } catch {
      setQuestionsStatus("error");
      setErrorMessage("Could not load suggested questions.");
    }
  }, [text]);

  // Generate the suggested questions once, right after mount
  // (i.e. right after the summary has been generated).
  const suggestedLoadedRef = useRef(false);
  useEffect(() => {
    if (suggestedLoadedRef.current) return;
    suggestedLoadedRef.current = true;
    void loadQuestions();
  }, [loadQuestions]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [conversation]);

  const askQuestion = async (question: string) => {
    const trimmed = question.trim();

    if (!trimmed || answerStatus === "loading") return;

    setInputValue("");
    setAnswerStatus("loading");
    setErrorMessage(null);

    const entryId = nextIdRef.current++;
    setConversation((previous) => [
      ...previous,
      { id: entryId, question: trimmed },
    ]);
    setAskedQuestions((previous) => new Set(previous).add(trimmed));

    try {
      const response = await fetch("/api/qa/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, question: trimmed }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error?.message ??
            "Something went wrong while answering. Please try again."
        );
      }

      const answer: string = payload.data.answer;

      setConversation((previous) =>
        previous.map((entry) =>
          entry.id === entryId ? { ...entry, answer } : entry
        )
      );
      setAnswerStatus("success");
    } catch (error) {
      setAnswerStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while answering. Please try again."
      );
      // Remove the pending entry so the user can retry cleanly.
      setConversation((previous) =>
        previous.filter((entry) => entry.id !== entryId)
      );
    }
  };

  const retrySuggestedQuestions = () => {
    void loadQuestions();
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
        <MessageCircleQuestion
          aria-hidden="true"
          className="h-4 w-4 text-zinc-500"
        />
        <p className="text-sm font-medium text-zinc-900">
          Ask questions about this document
        </p>
      </div>

      <div className="space-y-3 px-3 py-3">
        {/* Suggested questions */}
        {questionsStatus === "loading" && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500"
          >
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            Suggesting questions…
          </div>
        )}

        {questionsStatus === "error" && errorMessage && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="flex items-start gap-1.5 text-xs text-red-700">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={retrySuggestedQuestions}
              className="flex shrink-0 items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
            >
              <RotateCcw aria-hidden="true" className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {questionsStatus === "success" && suggestedQuestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions.map((question) => (
              <button
                key={question}
                type="button"
                disabled={answerStatus === "loading"}
                onClick={() => void askQuestion(question)}
                className={cn(
                  "flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-left text-xs text-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1",
                  askedQuestions.has(question)
                    ? "opacity-50"
                    : "hover:border-zinc-300 hover:bg-zinc-100",
                  answerStatus === "loading" &&
                    !askedQuestions.has(question) &&
                    "cursor-not-allowed opacity-50"
                )}
              >
                <HelpCircle aria-hidden="true" className="h-3 w-3 shrink-0 text-zinc-400" />
                {question}
              </button>
            ))}
          </div>
        )}

        {/* Free-text question input */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void askQuestion(inputValue);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Ask anything about this document…"
            aria-label="Ask a question about the document"
            className="min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1"
          />
          <button
            type="submit"
            disabled={answerStatus === "loading" || !inputValue.trim()}
            className="shrink-0 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            Ask
          </button>
        </form>

        {/* Conversation */}
        {conversation.length > 0 && (
          <div className="space-y-3">
            {conversation.map((entry) => (
              <div key={entry.id} className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-900">
                  {entry.question}
                </p>

                {entry.answer === undefined ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500"
                  >
                    <Loader2
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin"
                    />
                    Searching the document and generating an answer…
                  </div>
                ) : (
                  <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-relaxed text-zinc-700">
                    {entry.answer}
                  </p>
                )}
              </div>
            ))}
            <div ref={conversationEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
