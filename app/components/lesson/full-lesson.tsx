import { useFetcher } from "react-router";
import type { Route } from "../../routes/+types/courses.$slug.lessons.$lessonId";
import { CommentThread } from "~/components/comment-thread";
import { Card, CardContent } from "~/components/ui/card";
import { YouTubePlayer } from "~/components/youtube-player";
import { LessonNote } from "~/components/lesson-note";
import { CurriculumSidebar } from "~/components/lesson/curriculum-sidebar";
import { LessonBreadcrumb } from "~/components/lesson/lesson-breadcrumb";
import { LessonHeader } from "~/components/lesson/lesson-header";
import { LessonCompletion } from "~/components/lesson/lesson-completion";
import { LessonPager } from "~/components/lesson/lesson-pager";
import { QuizSection } from "~/components/lesson/quiz-section";
import { useAutoplay } from "~/components/lesson/use-autoplay";
import type { QuizFetcherData } from "~/components/lesson/quiz-types";

export type FullLessonData = Extract<
  Route.ComponentProps["loaderData"],
  { view: "full" }
>;

export function FullLesson({ data }: { data: FullLessonData }) {
  const { course, curriculum, module: mod, lesson, enrolled } = data;

  return (
    <div className="flex">
      <CurriculumSidebar
        course={course}
        curriculum={curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={data.lessonProgressMap}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={mod}
          lessonTitle={lesson.title}
        />
        <LessonBody data={data} />
      </div>
    </div>
  );
}

function LessonBody({ data }: { data: FullLessonData }) {
  const { course, lesson, enrolled, currentUserId } = data;
  const signedInStudent = enrolled && !!currentUserId;

  return (
    <div className="mx-auto max-w-4xl">
      <LessonHeader
        lesson={lesson}
        showBookmark={!!currentUserId}
        bookmarked={data.bookmarked}
      />

      <LessonMedia data={data} />

      {data.quiz && signedInStudent && (
        <LessonQuiz
          lessonId={lesson.id}
          quiz={data.quiz}
          bestAttempt={data.bestAttempt}
        />
      )}

      {signedInStudent && (
        <LessonCompletion
          lessonId={lesson.id}
          courseSlug={course.slug}
          lessonStatus={data.lessonStatus}
          nextLesson={data.nextLesson}
        />
      )}

      {/* Questions & Discussion — confidential to people with access */}
      <CommentThread
        comments={data.comments}
        currentUserId={currentUserId}
        canModerate={data.canModerate}
        canPost
        instructorName={data.instructorName}
      />

      <LessonPager
        course={course}
        prevLesson={data.prevLesson}
        nextLesson={data.nextLesson}
      />
    </div>
  );
}

function LessonMedia({ data }: { data: FullLessonData }) {
  const { lesson, contentHtml, currentUserId } = data;
  const [autoplay, toggleAutoplay] = useAutoplay();

  return (
    <>
      {lesson.videoUrl && (
        <YouTubePlayer
          videoUrl={lesson.videoUrl}
          lessonId={lesson.id}
          title={lesson.title}
          startPosition={data.lastWatchPosition}
          durationMinutes={lesson.durationMinutes}
          watchProgress={data.watchProgress}
          trackingEnabled={data.enrolled && !!currentUserId}
          autoplay={autoplay}
          onToggleAutoplay={toggleAutoplay}
        />
      )}

      {/* Note — under the video, so the Student can write while they watch */}
      {currentUserId && <LessonNote note={data.note} />}

      {contentHtml && (
        <div
          className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
          // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}

      {!contentHtml && !lesson.videoUrl && (
        <Card className="mb-8">
          <CardContent className="py-12 text-center text-muted-foreground">
            No content has been added to this lesson yet.
          </CardContent>
        </Card>
      )}
    </>
  );
}

function LessonQuiz({
  lessonId,
  quiz,
  bestAttempt,
}: {
  lessonId: number;
  quiz: NonNullable<FullLessonData["quiz"]>;
  bestAttempt: FullLessonData["bestAttempt"];
}) {
  const quizFetcher = useFetcher<QuizFetcherData>({ key: `quiz-${lessonId}` });

  return (
    <QuizSection
      quiz={quiz}
      bestAttempt={bestAttempt}
      quizFetcher={quizFetcher}
    />
  );
}
