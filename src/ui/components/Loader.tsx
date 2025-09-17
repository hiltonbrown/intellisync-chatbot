"use client";
/*
 * Documentation:
 * Loader — https://app.subframe.com/84ec9af13098/library?component=Loader_f2e570c8-e463-45c2-aae9-a960146bc5d5
 */

import React from "react";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface LoaderRootProps
  extends React.ComponentProps<typeof SubframeCore.Loader> {
  size?: "small" | "medium" | "large";
  className?: string;
}

const LoaderRoot = React.forwardRef<
  React.ElementRef<typeof SubframeCore.Loader>,
  LoaderRootProps
>(function LoaderRoot(
  { size = "medium", className, ...otherProps }: LoaderRootProps,
  ref
) {
  return (
    <SubframeCore.Loader
      className={SubframeUtils.twClassNames(
        'group/f2e570c8 font-body text-body text-brand-600',
        {
          'font-heading-2 text-heading-2': size === "large",
          'font-caption text-caption': size === "small",
        },
        className
      )}
      ref={ref}
      {...otherProps}
    />
  );
});

export const Loader = LoaderRoot;
