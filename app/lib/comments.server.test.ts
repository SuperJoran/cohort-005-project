import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { postComment } from "./comments.server";
import { getNotificationFeed } from "./notifications.server";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;
let instructorId: number;

function addStudent(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase()}@example.com`,
      role: UserRole.Student,
    })
    .returning()
    .get();
}

function feedOf(userId: number) {
  return getNotificationFeed(db, userId).latestUnread.map(({ text, link }) => ({
    text,
    link,
  }));
}

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  instructorId = base.instructor.id;
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Hooks", position: 1 })
    .returning()
    .get().id;
});

describe("replying to a comment", () => {
  it("notifies the top-level comment author, linking to the thread", () => {
    const ann = addStudent("Ann");
    const ben = addStudent("Ben");
    const question = postComment(db, ann.id, lessonId, null, "How?");

    postComment(db, ben.id, lessonId, question.id, "Like this.");

    expect(feedOf(ann.id)).toEqual([
      {
        text: "Ben replied to your comment on Hooks",
        link: `/courses/test-course/lessons/${lessonId}#comment-${question.id}`,
      },
    ]);
  });

  it("never notifies someone replying to their own comment", () => {
    const ann = addStudent("Ann");
    const question = postComment(db, ann.id, lessonId, null, "How?");

    postComment(db, ann.id, lessonId, question.id, "Never mind, got it.");

    expect(feedOf(ann.id)).toEqual([]);
  });

  it("gives earlier repliers nothing", () => {
    const ann = addStudent("Ann");
    const ben = addStudent("Ben");
    const cat = addStudent("Cat");
    const question = postComment(db, ann.id, lessonId, null, "How?");
    postComment(db, ben.id, lessonId, question.id, "Like this.");

    postComment(db, cat.id, lessonId, question.id, "Or like that.");

    expect(feedOf(ben.id)).toEqual([]);
    expect(feedOf(ann.id).map(({ text }) => text)).toEqual([
      "Cat replied to your comment on Hooks",
      "Ben replied to your comment on Hooks",
    ]);
  });

  it("reaches the Instructor through the reply rule only when they wrote the comment", () => {
    const ann = addStudent("Ann");
    const announcement = postComment(db, instructorId, lessonId, null, "Hi!");

    postComment(db, ann.id, lessonId, announcement.id, "Thanks!");

    expect(feedOf(instructorId).map(({ text }) => text)).toEqual([
      "Ann replied to your comment on Hooks",
    ]);
  });

  it("notifies no one when the top-level comment is deleted", () => {
    const ann = addStudent("Ann");
    const ben = addStudent("Ben");
    const question = postComment(db, ann.id, lessonId, null, "How?");
    db.update(schema.comments)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(schema.comments.id, question.id))
      .run();

    postComment(db, ben.id, lessonId, question.id, "Like this.");

    expect(feedOf(ann.id)).toEqual([]);
  });

  it("never quotes the comment body", () => {
    const ann = addStudent("Ann");
    const ben = addStudent("Ben");
    const question = postComment(db, ann.id, lessonId, null, "Secret question");

    postComment(db, ben.id, lessonId, question.id, "Secret answer");

    const texts = [...feedOf(ann.id), ...feedOf(instructorId)].map(
      ({ text }) => text
    );
    expect(texts.join(" ")).not.toContain("Secret");
  });
});

describe("posting a new top-level comment", () => {
  it("notifies the course's Instructor, linking to the questions queue", () => {
    const ann = addStudent("Ann");

    postComment(db, ann.id, lessonId, null, "How?");

    expect(feedOf(instructorId)).toEqual([
      {
        text: "New question on Hooks in Test Course",
        link: "/instructor/questions",
      },
    ]);
  });

  it("doesn't notify the Instructor about their own comment", () => {
    postComment(db, instructorId, lessonId, null, "Welcome!");

    expect(feedOf(instructorId)).toEqual([]);
  });
});

describe("posting fails without a trace", () => {
  it("writes no comment and no Notification when a reply goes two levels deep", () => {
    const ann = addStudent("Ann");
    const ben = addStudent("Ben");
    const question = postComment(db, ann.id, lessonId, null, "How?");
    const reply = postComment(db, instructorId, lessonId, question.id, "So.");

    expect(() =>
      postComment(db, ben.id, lessonId, reply.id, "Nested?")
    ).toThrow("Replies can only be one level deep");
    expect(feedOf(instructorId).map(({ text }) => text)).toEqual([
      "New question on Hooks in Test Course",
    ]);
  });
});
