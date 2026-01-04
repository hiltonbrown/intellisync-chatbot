"use client";

import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import { cn, sanitizeText } from "@/lib/utils";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        className
      )}
      {...props}
    >
      {typeof children === "string" ? sanitizeText(children) : children}
    </Streamdown>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
