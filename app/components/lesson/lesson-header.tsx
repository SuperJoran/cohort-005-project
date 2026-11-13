import { Clock, Github } from "lucide-react";
import { Button } from "~/components/ui/button";
import { BookmarkToggle } from "~/components/lesson/bookmark-toggle";
import { formatDuration } from "~/lib/utils";

export function LessonHeader({
  lesson,
  showBookmark,
  bookmarked,
}: {
  lesson: {
    title: string;
    durationMinutes: number | null;
    githubRepoUrl: string | null;
  };
  showBookmark: boolean;
  bookmarked: boolean;
}) {
  return (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {showBookmark && <BookmarkToggle bookmarked={bookmarked} />}
      </div>
      <div className="mb-6 flex items-center gap-3">
        {lesson.durationMinutes && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </div>
        )}
        {lesson.githubRepoUrl && (
          <a
            href={lesson.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="mr-1.5 size-4" />
              Open Code
            </Button>
          </a>
        )}
      </div>
    </>
  );
}
