import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus, UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import {
  createLanding,
  FEATURED_COURSE_LIMIT,
  TOPIC_LIMIT,
} from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

function get() {
  return createLanding(db).get();
}

// ─── Fixtures ───
// The landing module only reads, so rows go in directly. Kept in one place so
// a schema change touches only this block.

let counter = 0;

function addUser(role = UserRole.Student) {
  counter += 1;
  return db
    .insert(schema.users)
    .values({ name: `User ${counter}`, email: `u${counter}@example.com`, role })
    .returning()
    .get();
}

function addCategory(name: string) {
  return db
    .insert(schema.categories)
    .values({ name, slug: name.toLowerCase() })
    .returning()
    .get();
}

function addCourse(
  title: string,
  options: {
    status?: CourseStatus;
    instructorId?: number;
    categoryId?: number;
    createdAt?: string;
  } = {}
) {
  counter += 1;
  return db
    .insert(schema.courses)
    .values({
      title,
      slug: `course-${counter}`,
      description: `About ${title}`,
      salesCopy: markdown(title),
      instructorId: options.instructorId ?? base.instructor.id,
      categoryId: options.categoryId ?? base.category.id,
      status: options.status ?? CourseStatus.Published,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    })
    .returning()
    .get();
}

function addLessons(courseId: number, count: number) {
  const mod = db
    .insert(schema.modules)
    .values({ courseId, title: "Module", position: 1 })
    .returning()
    .get();
  for (let i = 0; i < count; i++) {
    db.insert(schema.lessons)
      .values({ moduleId: mod.id, title: `Lesson ${i}`, position: i })
      .run();
  }
}

function enroll(courseId: number, students: number) {
  for (let i = 0; i < students; i++) {
    db.insert(schema.enrollments)
      .values({ userId: addUser().id, courseId })
      .run();
  }
}

// The seeded base course is the oldest; push it back so ordering by date is
// unambiguous.
function ageBaseCourse() {
  db.update(schema.courses)
    .set({ createdAt: "2020-01-01T00:00:00.000Z" })
    .run();
}

describe("featured courses", () => {
  it("lists the most enrolled published courses first", () => {
    ageBaseCourse();
    const quiet = addCourse("Quiet");
    const busy = addCourse("Busy");
    enroll(busy.id, 3);
    enroll(quiet.id, 1);

    const featured = get().featuredCourses;

    expect(featured.map((c) => c.title)).toEqual([
      "Busy",
      "Quiet",
      "Test Course",
    ]);
    expect(featured.map((c) => c.studentCount)).toEqual([3, 1, 0]);
  });

  it("breaks a tie with the newest course first", () => {
    ageBaseCourse();
    addCourse("Older", { createdAt: "2025-01-01T00:00:00.000Z" });
    addCourse("Newer", { createdAt: "2026-01-01T00:00:00.000Z" });

    expect(get().featuredCourses.map((c) => c.title)).toEqual([
      "Newer",
      "Older",
      "Test Course",
    ]);
  });

  it(`shows at most ${FEATURED_COURSE_LIMIT}`, () => {
    for (let i = 0; i < FEATURED_COURSE_LIMIT + 2; i++) addCourse(`C${i}`);

    expect(get().featuredCourses).toHaveLength(FEATURED_COURSE_LIMIT);
  });

  it("leaves out courses that are not published", () => {
    const draft = addCourse("Draft", { status: CourseStatus.Draft });
    const archived = addCourse("Archived", { status: CourseStatus.Archived });
    enroll(draft.id, 5);
    enroll(archived.id, 5);

    expect(get().featuredCourses.map((c) => c.title)).toEqual(["Test Course"]);
  });

  it("counts every lesson across a course's modules", () => {
    addLessons(base.course.id, 2);
    addLessons(base.course.id, 3);

    expect(get().featuredCourses[0]).toMatchObject({
      title: "Test Course",
      slug: "test-course",
      description: "A test course",
      coverImageUrl: null,
      instructorName: "Test Instructor",
      categoryName: "Programming",
      lessonCount: 5,
      studentCount: 0,
    });
  });

  it("is empty when nothing is published", () => {
    db.update(schema.courses).set({ status: CourseStatus.Draft }).run();

    expect(get().featuredCourses).toEqual([]);
  });
});

describe("topics", () => {
  it("lists categories with published courses, largest first", () => {
    const design = addCategory("Design");
    const data = addCategory("Data");
    addCategory("Empty");
    addCourse("D1", { categoryId: design.id });
    addCourse("D2", { categoryId: design.id });
    addCourse("Data draft", {
      categoryId: data.id,
      status: CourseStatus.Draft,
    });

    expect(get().topics).toEqual([
      { name: "Design", slug: "design", courseCount: 2 },
      { name: "Programming", slug: "programming", courseCount: 1 },
    ]);
  });

  it("orders topics of the same size by name", () => {
    const b = addCategory("Beta");
    const a = addCategory("Alpha");
    addCourse("B", { categoryId: b.id });
    addCourse("A", { categoryId: a.id });

    expect(get().topics.map((t) => t.name)).toEqual([
      "Alpha",
      "Beta",
      "Programming",
    ]);
  });

  it(`shows at most ${TOPIC_LIMIT}`, () => {
    for (let i = 0; i < TOPIC_LIMIT + 2; i++) {
      addCourse(`C${i}`, { categoryId: addCategory(`Cat${i}`).id });
    }

    expect(get().topics).toHaveLength(TOPIC_LIMIT);
  });
});

describe("stats", () => {
  it("counts published courses, their lessons and their instructors", () => {
    const second = addUser(UserRole.Instructor);
    const other = addCourse("Other", { instructorId: second.id });
    addCourse("Same instructor");
    const draft = addCourse("Draft", {
      status: CourseStatus.Draft,
      instructorId: addUser(UserRole.Instructor).id,
    });
    addLessons(base.course.id, 2);
    addLessons(other.id, 4);
    addLessons(draft.id, 7);

    expect(get().stats).toEqual({ courses: 3, lessons: 6, instructors: 2 });
  });

  it("is all zeroes when nothing is published", () => {
    db.update(schema.courses).set({ status: CourseStatus.Draft }).run();

    expect(get().stats).toEqual({ courses: 0, lessons: 0, instructors: 0 });
  });
});
