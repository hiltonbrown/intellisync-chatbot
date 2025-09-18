'use client';
/*
 * Documentation:
 * Badge — https://app.subframe.com/84ec9af13098/library?component=Badge_97bdb082-1124-4dd7-a335-b14b822d0157
 */

import React from 'react';
import * as SubframeCore from '@subframe/core';
import * as SubframeUtils from '../utils';

interface BadgeRootProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'brand' | 'neutral' | 'error' | 'warning' | 'success';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  iconRight?: React.ReactNode;
  className?: string;
}

const BadgeRoot = React.forwardRef<HTMLDivElement, BadgeRootProps>(
  function BadgeRoot(
    {
      variant = 'brand',
      icon = null,
      children,
      iconRight = null,
      className,
      ...otherProps
    }: BadgeRootProps,
    ref,
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          'group/97bdb082 flex h-6 items-center gap-1 rounded-md border border-brand-100 border-solid bg-brand-100 px-2',
          {
            'border border-success-100 border-solid bg-success-100':
              variant === 'success',
            'border border-warning-100 border-solid bg-warning-100':
              variant === 'warning',
            'border border-error-100 border-solid bg-error-100':
              variant === 'error',
            'border border-neutral-100 border-solid bg-neutral-100':
              variant === 'neutral',
          },
          className,
        )}
        ref={ref}
        {...otherProps}
      >
        {icon ? (
          <SubframeCore.IconWrapper
            className={SubframeUtils.twClassNames(
              'font-caption text-brand-700 text-caption',
              {
                'text-success-800': variant === 'success',
                'text-warning-800': variant === 'warning',
                'text-error-700': variant === 'error',
                'text-neutral-700': variant === 'neutral',
              },
            )}
          >
            {icon}
          </SubframeCore.IconWrapper>
        ) : null}
        {children ? (
          <span
            className={SubframeUtils.twClassNames(
              'whitespace-nowrap font-caption text-brand-800 text-caption',
              {
                'text-success-800': variant === 'success',
                'text-warning-800': variant === 'warning',
                'text-error-800': variant === 'error',
                'text-neutral-700': variant === 'neutral',
              },
            )}
          >
            {children}
          </span>
        ) : null}
        {iconRight ? (
          <SubframeCore.IconWrapper
            className={SubframeUtils.twClassNames(
              'font-caption text-brand-700 text-caption',
              {
                'text-success-800': variant === 'success',
                'text-warning-800': variant === 'warning',
                'text-error-700': variant === 'error',
                'text-neutral-700': variant === 'neutral',
              },
            )}
          >
            {iconRight}
          </SubframeCore.IconWrapper>
        ) : null}
      </div>
    );
  },
);

export const Badge = BadgeRoot;
