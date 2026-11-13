import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RotateCcw, Trophy } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { QuizForm } from "~/components/lesson/quiz-form";
import { QuizResults } from "~/components/lesson/quiz-results";
import type {
  Quiz,
  QuizFetcher,
  QuizResult,
} from "~/components/lesson/quiz-types";

export function QuizSection({
  quiz,
  bestAttempt,
  quizFetcher,
}: {
  quiz: Quiz;
  bestAttempt: { score: number; passed: boolean } | null;
  quizFetcher: QuizFetcher;
}) {
  const quizResult = quizFetcher.data?.quizResult ?? null;
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [showQuiz, setShowQuiz] = useState(!bestAttempt?.passed);
  const [retaking, setRetaking] = useState(false);

  useQuizResultToast(quizResult, retaking);

  if (quizResult && !retaking) {
    return (
      <QuizResults
        quiz={quiz}
        quizResult={quizResult}
        onRetake={() => {
          setSelectedAnswers({});
          setRetaking(true);
        }}
      />
    );
  }

  if (!showQuiz && bestAttempt?.passed) {
    return (
      <QuizPassed
        title={quiz.title}
        bestScore={bestAttempt.score}
        onRetake={() => setShowQuiz(true)}
      />
    );
  }

  return (
    <QuizForm
      quiz={quiz}
      quizFetcher={quizFetcher}
      isSubmitting={quizFetcher.state !== "idle"}
      selectedAnswers={selectedAnswers}
      onSelect={(questionId, optionId) =>
        setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }))
      }
      onSubmit={() => setRetaking(false)}
    />
  );
}

function QuizPassed({
  title,
  bestScore,
  onRetake,
}: {
  title: string;
  bestScore: number;
  onRetake: () => void;
}) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-green-600" />
            <span className="font-medium">{title}</span>
            <span className="text-sm text-muted-foreground">
              — Best score: {Math.round(bestScore * 100)}%
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onRetake}>
            <RotateCcw className="mr-2 size-4" />
            Retake
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function useQuizResultToast(quizResult: QuizResult | null, retaking: boolean) {
  useEffect(() => {
    if (quizResult && !retaking) {
      const score = Math.round(quizResult.score * 100);
      if (quizResult.passed) {
        toast.success(`Quiz passed! Score: ${score}%`);
      } else {
        toast.error(`Quiz not passed. Score: ${score}%`);
      }
    }
  }, [quizResult, retaking]);
}
