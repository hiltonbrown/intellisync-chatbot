'use client';
/*
 * Documentation:
 * Checkbox Card — https://app.subframe.com/84ec9af13098/library?component=Checkbox+Card_de0b4dfb-3946-4702-be52-5678dd71925a
 */

import React from 'react';
import { FeatherCheck } from '@subframe/core';
import * as SubframeCore from '@subframe/core';
import * as SubframeUtils from '../utils';

interface CheckboxCardRootProps
  extends React.ComponentProps<typeof SubframeCore.Checkbox.Root> {
  hideCheckbox?: boolean;
  children?: React.ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

const CheckboxCardRoot = React.forwardRef<
  HTMLButtonElement,
  CheckboxCardRootProps
>(function CheckboxCardRoot(
  {
    hideCheckbox = false,
    children,
    className,
    ...otherProps
  }: CheckboxCardRootProps,
  ref,
) {
  return (
    <SubframeCore.Checkbox.Root asChild={true} {...otherProps}>
      <button
        type="button"
        className={SubframeUtils.twClassNames(
          'group/de0b4dfb flex cursor-pointer items-center gap-4 rounded-md border border-neutral-border border-solid bg-default-background px-4 py-3 text-left hover:border hover:border-neutral-border hover:border-solid hover:bg-neutral-50 disabled:cursor-default disabled:border disabled:border-neutral-100 disabled:border-solid disabled:bg-neutral-100 hover:disabled:cursor-default hover:disabled:border hover:disabled:border-neutral-100 hover:disabled:border-solid hover:disabled:bg-neutral-100 aria-[checked=true]:border aria-[checked=true]:border-brand-200 aria-[checked=true]:border-solid aria-[checked=true]:bg-brand-50 hover:aria-[checked=true]:border hover:aria-[checked=true]:border-brand-200 hover:aria-[checked=true]:border-solid hover:aria-[checked=true]:bg-brand-50',
          className,
        )}
        ref={ref}
      >
        <div
          className={SubframeUtils.twClassNames(
            'flex h-4 w-4 flex-none flex-col items-center justify-center gap-2 rounded-[2px] border-2 border-neutral-300 border-solid group-disabled/de0b4dfb:border-2 group-disabled/de0b4dfb:border-neutral-200 group-disabled/de0b4dfb:border-solid group-disabled/de0b4dfb:bg-neutral-100 group-aria-[checked=true]/de0b4dfb:border group-aria-[checked=true]/de0b4dfb:border-brand-600 group-aria-[checked=true]/de0b4dfb:border-solid group-aria-[checked=true]/de0b4dfb:bg-brand-600',
            { hidden: hideCheckbox },
          )}
        >
          <FeatherCheck className='hidden font-["Inter"] font-[400] text-[14px] text-white leading-[14px] group-disabled/de0b4dfb:text-neutral-400 group-aria-[checked=true]/de0b4dfb:inline-flex group-aria-[checked=true]/de0b4dfb:font-["Inter"] group-aria-[checked=true]/de0b4dfb:font-[400] group-aria-[checked=true]/de0b4dfb:text-[16px] group-aria-[checked=true]/de0b4dfb:leading-[16px] group-aria-[checked=true]/de0b4dfb:tracking-normal' />
        </div>
        {children ? (
          <div className="flex shrink-0 grow basis-0 items-center gap-4">
            {children}
          </div>
        ) : null}
      </button>
    </SubframeCore.Checkbox.Root>
  );
});

export const CheckboxCard = CheckboxCardRoot;
