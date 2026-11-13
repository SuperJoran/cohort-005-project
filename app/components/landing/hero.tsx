import { Link } from "react-router";
import { ArrowRight, BookOpen, Sparkles, Users } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CourseImage } from "~/components/course-image";
import type {
  FeaturedCourse,
  LandingStats,
} from "~/modules/landing/index.server";

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function LandingHero({
  stats,
  spotlight,
  signedIn,
}: {
  stats: LandingStats;
  spotlight: FeaturedCourse | undefined;
  signedIn: boolean;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background via-background to-muted/70"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Self-paced courses for developers
          </p>
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Learn to code,
            <br />
            <span className="text-muted-foreground">at your own pace.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Structured courses built by experienced instructors. Track your
            progress, take quizzes, and build real-world skills — on your
            schedule.
          </p>
          <HeroActions signedIn={signedIn} />
          <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-8">
            <Stat value={stats.courses} label="Courses" />
            <Stat value={stats.lessons} label="Lessons" />
            <Stat value={stats.instructors} label="Instructors" />
          </dl>
        </div>
        {spotlight && <Spotlight course={spotlight} />}
      </div>
    </section>
  );
}

function HeroActions({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3">
      <Button asChild size="lg">
        <Link to="/courses">
          Browse Courses
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        {signedIn ? (
          <Link to="/dashboard">Go to your dashboard</Link>
        ) : (
          <Link to="/signup">Create a free account</Link>
        )}
      </Button>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-bold tracking-tight">{value}</dd>
    </div>
  );
}

function Spotlight({ course }: { course: FeaturedCourse }) {
  return (
    <div className="relative hidden lg:block">
      <Link
        to={`/courses/${course.slug}`}
        className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-xl transition-shadow hover:shadow-2xl"
      >
        <CourseImage
          src={course.coverImageUrl}
          alt={course.title}
          className="aspect-video w-full object-cover"
        />
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Most popular · {course.categoryName}
          </p>
          <h2 className="mt-2 text-xl font-semibold group-hover:text-primary">
            {course.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
            {course.description}
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="size-3.5" />
              {plural(course.lessonCount, "lesson", "lessons")}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {plural(course.studentCount, "student", "students")}
            </span>
            <span className="ml-auto">by {course.instructorName}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
