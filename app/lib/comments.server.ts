import { eq } from "drizzle-orm";
import {
  comments,
  courses,
  lessons,
  modules,
  users,
  NotificationKind,
} from "~/db/schema";
import {
  MIN_COMMENT_LENGTH,
  MAX_COMMENT_LENGTH,
  commentThreadAnchor,
} from "~/lib/comments";
import { notify, type Db } from "~/lib/notifications.server";

// ─── Comments ───
// Posting a comment on a lesson: a new top-level comment (a question) or a
// reply to one. Replies are one level deep only.
//
// Every function takes the database first, so tests can hand in an in-memory
// one. Uses positional parameters (project convention).

/** Trims a comment body and checks its length. Throws a user-facing Error. */
export function assertValidCommentBody(body: string) {
  const trimmed = body.trim();
  if (trimmed.length < MIN_COMMENT_LENGTH) {
    throw new Error("Comment cannot be empty");
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(
      `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer`
    );
  }
  return trimmed;
}

/**
 * Posts a comment, or a reply when `parentId` is set, and notifies whoever it
 * concerns: a reply reaches the top-level comment's author, a new top-level
 * comment reaches the course's Instructor. All in one transaction. Throws a
 * user-facing Error when the comment can't be posted.
 */
export function postComment(
  db: Db,
  userId: number,
  lessonId: number,
  parentId: number | null,
  body: string
) {
  const trimmed = assertValidCommentBody(body);

  return db.transaction((tx) => {
    const lesson = tx
      .select({
        lessonTitle: lessons.title,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        instructorId: courses.instructorId,
      })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .innerJoin(courses, eq(modules.courseId, courses.id))
      .where(eq(lessons.id, lessonId))
      .get();
    if (!lesson) {
      throw new Error("Lesson not found");
    }

    const parent =
      parentId === null
        ? null
        : tx.select().from(comments).where(eq(comments.id, parentId)).get();
    if (parentId !== null) {
      if (!parent) {
        throw new Error("Parent comment not found");
      }
      if (parent.lessonId !== lessonId) {
        throw new Error("Parent comment belongs to a different lesson");
      }
      if (parent.parentId !== null) {
        throw new Error("Replies can only be one level deep");
      }
    }

    const comment = tx
      .insert(comments)
      .values({ userId, lessonId, parentId, body: trimmed })
      .returning()
      .get();

    if (parent) {
      const replier = tx.select().from(users).where(eq(users.id, userId)).get()!;
      notify(tx, {
        kind: NotificationKind.CommentReplied,
        replierId: userId,
        replierName: replier.name,
        commentAuthorId: parent.userId,
        lessonTitle: lesson.lessonTitle,
        threadLink: `/courses/${lesson.courseSlug}/lessons/${lessonId}#${commentThreadAnchor(parent.id)}`,
      });
    } else {
      notify(tx, {
        kind: NotificationKind.QuestionPosted,
        authorId: userId,
        instructorId: lesson.instructorId,
        lessonTitle: lesson.lessonTitle,
        courseTitle: lesson.courseTitle,
      });
    }

    return comment;
  });
}
