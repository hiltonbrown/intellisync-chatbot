'use client';
/*
 * Documentation:
 * Text Area — https://app.subframe.com/84ec9af13098/library?component=Text+Area_4ec05ee8-8f1c-46b2-b863-5419aa7f5cce
 */

import React from 'react';
import * as SubframeUtils from '../utils';

interface InputProps
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    'placeholder'
  > {
  placeholder?: React.ReactNode;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
}

const Input = React.forwardRef<HTMLTextAreaElement, InputProps>(function Input(
  { placeholder, className, ...otherProps }: InputProps,
  ref,
) {
  return (
    <textarea
      className={SubframeUtils.twClassNames(
        'min-h-[96px] w-full border-none bg-transparent px-2 py-1.5 font-body text-body text-default-font outline-none placeholder:text-neutral-400',
        className,
      )}
      placeholder={placeholder as string}
      ref={ref}
      {...otherProps}
    />
  );
});

interface TextAreaRootProps
  extends React.HTMLAttributes<HTMLDivElement> {
  error?: boolean;
  variant?: 'outline' | 'filled';
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const TextAreaRoot = React.forwardRef<HTMLDivElement, TextAreaRootProps>(
  function TextAreaRoot(
    {
      error = false,
      variant = 'outline',
      label,
      helpText,
      children,
      className,
      ...otherProps
    }: TextAreaRootProps,
    ref,
  ) {
    return (
      <div
        className={SubframeUtils.twClassNames(
          'group/4ec05ee8 flex flex-col items-start gap-1',
          className,
        )}
        ref={ref}
        {...otherProps}
      >
        {label ? (
          <span className="font-caption-bold text-caption-bold text-default-font">
            {label}
          </span>
        ) : null}
        {children ? (
          <div
            className={SubframeUtils.twClassNames(
              'flex w-full shrink-0 grow basis-0 flex-col items-start rounded-md border border-neutral-border border-solid bg-default-background pl-1 group-focus-within/4ec05ee8:border group-focus-within/4ec05ee8:border-brand-primary group-focus-within/4ec05ee8:border-solid',
              {
                'border border-neutral-100 border-solid bg-neutral-100 group-focus-within/4ec05ee8:bg-default-background group-hover/4ec05ee8:border group-hover/4ec05ee8:border-neutral-border group-hover/4ec05ee8:border-solid':
                  variant === 'filled',
                'border border-error-600 border-solid': error,
              },
            )}
          >
            {children}
          </div>
        ) : null}
        {helpText ? (
          <span
            className={SubframeUtils.twClassNames(
              'font-caption text-caption text-subtext-color',
              { 'text-error-700': error },
            )}
          >
            {helpText}
          </span>
        ) : null}
      </div>
    );
  },
);

export const TextArea = Object.assign(TextAreaRoot, {
  Input,
});
