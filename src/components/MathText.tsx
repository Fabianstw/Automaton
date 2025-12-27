import { useMemo } from "react";
import { renderToString } from "katex";
import "katex/dist/katex.min.css";

import { cn } from "@/lib/utils";

export type MathTextProps = {
  expression: string;
  block?: boolean;
  className?: string;
};

export function MathText({
  expression,
  block = false,
  className,
}: MathTextProps) {
  const html = useMemo(
    () =>
      renderToString(expression, { throwOnError: false, displayMode: block }),
    [expression, block],
  );

  return (
    <span
      className={cn(block ? "block" : "inline-block", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
