'use client';
/*
 * Documentation:
 * Settings Menu — https://app.subframe.com/84ec9af13098/library?component=Settings+Menu_786775dd-5f70-4b46-85ee-a3c74e6a00d6
 */

import React from 'react';
import { FeatherUser } from '@subframe/core';
import * as SubframeCore from '@subframe/core';
import * as SubframeUtils from '../utils';

interface ItemProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  className?: string;
}

const Item = React.forwardRef<HTMLDivElement, ItemProps>(function Item(
  {
    selected = false,
    icon = <FeatherUser />,
    label,
    className,
    ...otherProps
  }: ItemProps,
  ref,
) {
  return (
    <div
      className={SubframeUtils.twClassNames(
        'group/cd4ad3a1 flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-1 hover:bg-default-background active:bg-brand-50',
        { 'bg-brand-100 hover:bg-brand-100 active:bg-brand-50': selected },
        className,
      )}
      ref={ref}
      {...otherProps}
    >
      {icon ? (
        <SubframeCore.IconWrapper
          className={SubframeUtils.twClassNames(
            'font-body text-body text-default-font',
            { 'text-brand-700': selected },
          )}
        >
          {icon}
        </SubframeCore.IconWrapper>
      ) : null}
      {label ? (
        <span
          className={SubframeUtils.twClassNames(
            'line-clamp-1 shrink-0 grow basis-0 font-body text-body text-default-font',
            {
              'font-body-bold text-body-bold text-brand-700 group-hover/cd4ad3a1:text-brand-700 group-active/cd4ad3a1:text-brand-700':
                selected,
            },
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
});

interface SettingsMenuRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

const SettingsMenuRoot = React.forwardRef<
  HTMLDivElement,
  SettingsMenuRootProps
>(function SettingsMenuRoot(
  { children, className, ...otherProps }: SettingsMenuRootProps,
  ref,
) {
  return children ? (
    <div
      className={SubframeUtils.twClassNames(
        'group/786775dd flex h-full w-60 flex-col items-start gap-8 border-neutral-border border-r border-solid bg-default-background px-6 py-6',
        className,
      )}
      ref={ref}
      {...otherProps}
    >
      {children}
    </div>
  ) : null;
});

export const SettingsMenu = Object.assign(SettingsMenuRoot, {
  Item,
});
