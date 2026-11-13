import { db } from "~/db";
import { getLandingPage, type Db } from "./lib/landing";

export type {
  FeaturedCourse,
  LandingPage,
  LandingStats,
  Topic,
} from "./lib/landing";
export { FEATURED_COURSE_LIMIT, TOPIC_LIMIT } from "./lib/landing";

/**
 * The public landing page's content, bound to a database. The app uses
 * `landing`; tests build their own against a test database.
 */
export function createLanding(database: Db) {
  return {
    /**
     * Everything the landing page shows about the catalogue. Only published
     * courses count. Featured courses are the most enrolled, newest first on
     * a tie.
     */
    get() {
      return getLandingPage(database);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const landing = /* @__PURE__ */ createLanding(db);
