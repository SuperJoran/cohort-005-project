import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, countDistinct, desc, eq, sql } from "drizzle-orm";
import * as schema from "~/db/schema";
import { CourseStatus } from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

const { courses, categories, users, modules, lessons, enrollments } = schema;

export const FEATURED_COURSE_LIMIT = 3;
export const TOPIC_LIMIT = 8;

export type FeaturedCourse = {
  id: number;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  instructorName: string;
  categoryName: string;
  lessonCount: number;
  studentCount: number;
};

export type Topic = { name: string; slug: string; courseCount: number };

export type LandingStats = {
  courses: number;
  lessons: number;
  instructors: number;
};

export type LandingPage = {
  featuredCourses: FeaturedCourse[];
  topics: Topic[];
  stats: LandingStats;
};

const isPublished = eq(courses.status, CourseStatus.Published);

function getFeaturedCourses(db: Db): FeaturedCourse[] {
  const lessonCount = sql<number>`(
    select count(*) from ${lessons}
    inner join ${modules} on ${lessons.moduleId} = ${modules.id}
    where ${modules.courseId} = ${courses.id}
  )`.mapWith(Number);
  const studentCount = sql<number>`(
    select count(*) from ${enrollments}
    where ${enrollments.courseId} = ${courses.id}
  )`.mapWith(Number);

  return db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      coverImageUrl: courses.coverImageUrl,
      instructorName: users.name,
      categoryName: categories.name,
      lessonCount,
      studentCount,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(isPublished)
    .orderBy(desc(studentCount), desc(courses.createdAt), desc(courses.id))
    .limit(FEATURED_COURSE_LIMIT)
    .all();
}

function getTopics(db: Db): Topic[] {
  const courseCount = sql<number>`count(${courses.id})`.mapWith(Number);
  return db
    .select({ name: categories.name, slug: categories.slug, courseCount })
    .from(categories)
    .innerJoin(courses, and(eq(courses.categoryId, categories.id), isPublished))
    .groupBy(categories.id)
    .orderBy(desc(courseCount), categories.name)
    .limit(TOPIC_LIMIT)
    .all();
}

function getStats(db: Db): LandingStats {
  // An aggregate without GROUP BY always yields exactly one row.
  const [courseTotals] = db
    .select({
      courses: sql<number>`count(*)`.mapWith(Number),
      instructors: countDistinct(courses.instructorId),
    })
    .from(courses)
    .where(isPublished)
    .all();
  const [lessonTotals] = db
    .select({ lessons: sql<number>`count(*)`.mapWith(Number) })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(isPublished)
    .all();

  return {
    courses: courseTotals.courses,
    instructors: courseTotals.instructors,
    lessons: lessonTotals.lessons,
  };
}

export function getLandingPage(db: Db): LandingPage {
  return {
    featuredCourses: getFeaturedCourses(db),
    topics: getTopics(db),
    stats: getStats(db),
  };
}
