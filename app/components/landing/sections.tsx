import { Link } from "react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  PlayCircle,
  User,
  Users,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { CourseImage } from "~/components/course-image";
import type { FeaturedCourse, Topic } from "~/modules/landing/index.server";
import { plural } from "~/lib/utils";

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2>
      {children && (
        <p className="mt-3 max-w-xl text-muted-foreground">{children}</p>
      )}
    </div>
  );
}

export function TopicsSection({ topics }: { topics: Topic[] }) {
  if (topics.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20">
      <SectionHeading eyebrow="Explore" title="Pick a topic" />
      <ul className="mt-8 flex flex-wrap gap-3">
        {topics.map((topic) => (
          <li key={topic.slug}>
            <Link
              to={`/courses?category=${encodeURIComponent(topic.slug)}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-foreground hover:bg-muted"
            >
              {topic.name}
              <span className="text-muted-foreground">{topic.courseCount}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedCourseCard({ course }: { course: FeaturedCourse }) {
  return (
    <Link to={`/courses/${course.slug}`} className="group">
      <Card className="h-full overflow-hidden pt-0 transition-shadow group-hover:shadow-md">
        <CourseImage
          src={course.coverImageUrl}
          alt={course.title}
          className="aspect-video w-full object-cover"
        />
        <CardHeader>
          <p className="text-xs font-medium text-muted-foreground">
            {course.categoryName}
          </p>
          <h3 className="font-semibold leading-snug group-hover:text-primary">
            {course.title}
          </h3>
        </CardHeader>
        <CardContent>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {course.description}
          </p>
        </CardContent>
        <CardFooter className="mt-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="size-3" />
            {course.instructorName}
          </span>
          <span className="ml-auto flex items-center gap-1">
            <BookOpen className="size-3" />
            {plural(course.lessonCount, "lesson", "lessons")}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {course.studentCount}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}

export function FeaturedCoursesSection({
  courses,
}: {
  courses: FeaturedCourse[];
}) {
  if (courses.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="Featured" title="Most popular courses">
          The courses students are enrolling in right now.
        </SectionHeading>
        <Button asChild variant="outline">
          <Link to="/courses">
            View all courses
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <FeaturedCourseCard key={course.id} course={course} />
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: Compass,
    title: "Find your course",
    body: "Browse by topic and preview what each course covers before you start.",
  },
  {
    icon: PlayCircle,
    title: "Learn at your pace",
    body: "Short video lessons, notes and hands-on code. Pause and pick up whenever you like.",
  },
  {
    icon: CheckCircle2,
    title: "Prove what you know",
    body: "Quizzes check your understanding and your progress is saved lesson by lesson.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading
          eyebrow="How it works"
          title="From first lesson to finished"
        />
        <ol className="mt-12 grid gap-10 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border">
                  <step.icon className="size-5" />
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function CallToActionSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="flex flex-col items-start justify-between gap-8 rounded-2xl bg-primary px-8 py-12 text-primary-foreground sm:px-12 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to start learning?
          </h2>
          <p className="mt-3 max-w-xl text-primary-foreground/70">
            Pick a course and work through it at whatever pace suits you.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" variant="secondary">
            <Link to="/courses">
              Browse Courses
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          {!signedIn && (
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/signup">Sign up free</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function FooterLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="text-muted-foreground hover:text-foreground">
      {children}
    </Link>
  );
}

export function LandingFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:justify-between">
        <div>
          <Link to="/" className="text-lg font-bold tracking-tight">
            Cadence
          </Link>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Structured, self-paced courses for developers.
          </p>
        </div>
        <nav className="flex gap-12 text-sm">
          <div className="flex flex-col gap-2">
            <p className="font-medium">Learn</p>
            <FooterLink to="/courses">All courses</FooterLink>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-medium">Account</p>
            {signedIn ? (
              <FooterLink to="/dashboard">Dashboard</FooterLink>
            ) : (
              <>
                <FooterLink to="/login">Log in</FooterLink>
                <FooterLink to="/signup">Sign up</FooterLink>
              </>
            )}
          </div>
        </nav>
      </div>
    </footer>
  );
}
