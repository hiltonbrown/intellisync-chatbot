"use client";
/*
 * Documentation:
 * Alert — https://app.subframe.com/84ec9af13098/library?component=Alert_3a65613d-d546-467c-80f4-aaba6a7edcd5
 */

import React from "react";
import { FeatherInfo } from "@subframe/core";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface AlertRootProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: "brand" | "neutral" | "error" | "success" | "warning";
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

const AlertRoot = React.forwardRef<HTMLDivElement, AlertRootProps>(
  function AlertRoot(
    {
      variant = "neutral",
      icon = <FeatherInfo />,
      title,
      description,
      actions,
      className,
      ...otherProps
    }: AlertRootProps,
    ref
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          'group/3a65613d flex w-full flex-col items-start gap-2 rounded-md border border-neutral-200 border-solid bg-neutral-50 py-3 pr-3 pl-4',
          {
            'border border-warning-100 border-solid bg-warning-50':
              variant === "warning",
            'border border-success-100 border-solid bg-success-50':
              variant === "success",
            'border border-error-100 border-solid bg-error-50':
              variant === "error",
            'border border-brand-100 border-solid bg-brand-50':
              variant === "brand",
          },
          className
        )}
        ref={ref}
        {...otherProps}
      >
        <div className="flex w-full items-center gap-4">
          {icon ? (
            <SubframeCore.IconWrapper
              className={SubframeUtils.twClassNames(
                'font-heading-3 text-heading-3 text-neutral-800',
                {
                  "text-warning-800": variant === "warning",
                  "text-success-800": variant === "success",
                  "text-error-800": variant === "error",
                  "text-brand-800": variant === "brand",
                }
              )}
            >
              {icon}
            </SubframeCore.IconWrapper>
          ) : null}
          <div className='flex shrink-0 grow basis-0 flex-col items-start'>
            {title ? (
              <span
                className={SubframeUtils.twClassNames(
                  'w-full whitespace-pre-wrap font-body-bold text-body-bold text-default-font',
                  {
                    "text-warning-900": variant === "warning",
                    "text-success-900": variant === "success",
                    "text-error-900": variant === "error",
                    "text-brand-900": variant === "brand",
                  }
                )}
              >
                {title}
              </span>
            ) : null}
            {description ? (
              <span
                className={SubframeUtils.twClassNames(
                  'w-full whitespace-pre-wrap font-caption text-caption text-subtext-color',
                  {
                    "text-warning-800": variant === "warning",
                    "text-success-800": variant === "success",
                    "text-error-800": variant === "error",
                    "text-brand-800": variant === "brand",
                  }
                )}
              >
                {description}
              </span>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center justify-end gap-1">{actions}</div>
          ) : null}
        </div>
      </div>
    );
  }
);

export const Alert = AlertRoot;
