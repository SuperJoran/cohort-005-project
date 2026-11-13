import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";

export function CoursesButton({
  children = "Browse Courses",
  ...buttonProps
}: Pick<React.ComponentProps<typeof Button>, "size" | "variant"> & {
  children?: string;
}) {
  return (
    <Button asChild {...buttonProps}>
      <Link to="/courses">
        {children}
        <ArrowRight className="ml-2 size-4" />
      </Link>
    </Button>
  );
}
