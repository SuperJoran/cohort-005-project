export const MIN_COMMENT_LENGTH = 1;
export const MAX_COMMENT_LENGTH = 5000;

/** The id a top-level comment's thread has on its lesson page, so links can scroll to it. */
export function commentThreadAnchor(commentId: number) {
  return `comment-${commentId}`;
}
