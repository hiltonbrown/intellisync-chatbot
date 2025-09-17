"use client";
/*
 * Documentation:
 * Table — https://app.subframe.com/84ec9af13098/library?component=Table_142dfde7-d0cc-48a1-a04c-a08ab2252633
 */

import React from "react";
import * as SubframeCore from "@subframe/core";
import * as SubframeUtils from "../utils";

interface RowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children?: React.ReactNode;
  clickable?: boolean;
  className?: string;
}

const Row = React.forwardRef<HTMLTableRowElement, RowProps>(function Row(
  { children, clickable = false, className, ...otherProps }: RowProps,
  ref
) {
  return (
    <tr
      className={SubframeUtils.twClassNames(
        'group/5d119f8d border-neutral-border border-t border-solid',
        { "hover:bg-neutral-50": clickable },
        className
      )}
      ref={ref}
      {...otherProps}
    >
      {children}
    </tr>
  );
});

interface CellProps extends React.TdHTMLAttributes<HTMLTableDataCellElement> {
  children?: React.ReactNode;
  className?: string;
}

const Cell = React.forwardRef<HTMLDivElement, CellProps>(function Cell(
  { children, className, ...otherProps }: CellProps,
  ref
) {
  return (
    <td {...otherProps}>
      <div
        className={SubframeUtils.twClassNames(
          "flex h-12 w-full items-center gap-1 px-3",
          className
        )}
        ref={ref}
      >
        {children}
      </div>
    </td>
  );
});

interface HeaderRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children?: React.ReactNode;
  className?: string;
}

const HeaderRow = React.forwardRef<HTMLTableRowElement, HeaderRowProps>(
  function HeaderRow(
    { children, className, ...otherProps }: HeaderRowProps,
    ref
  ) {
    return (
      <tr className={className} ref={ref} {...otherProps}>
        {children}
      </tr>
    );
  }
);

interface HeaderCellProps
  extends React.ThHTMLAttributes<HTMLTableHeaderCellElement> {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

const HeaderCell = React.forwardRef<HTMLDivElement, HeaderCellProps>(
  function HeaderCell(
    { children, icon = null, className, ...otherProps }: HeaderCellProps,
    ref
  ) {
    return (
      <th {...otherProps}>
        <div
          className={SubframeUtils.twClassNames(
            "flex h-8 w-full items-center gap-1 px-3",
            className
          )}
          ref={ref}
        >
          {children ? (
            <span className='whitespace-nowrap font-caption-bold text-caption-bold text-subtext-color'>
              {children}
            </span>
          ) : null}
          {icon ? (
            <SubframeCore.IconWrapper className='font-caption text-caption text-subtext-color'>
              {icon}
            </SubframeCore.IconWrapper>
          ) : null}
        </div>
      </th>
    );
  }
);

interface TableRootProps extends React.TableHTMLAttributes<HTMLTableElement> {
  header?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const TableRoot = React.forwardRef<HTMLTableElement, TableRootProps>(
  function TableRoot(
    { header, children, className, ...otherProps }: TableRootProps,
    ref
  ) {
    return (
      <table
        className={SubframeUtils.twClassNames("w-full", className)}
        ref={ref}
        {...otherProps}
      >
        <thead>{header}</thead>
        <tbody className='border-neutral-border border-b border-solid'>
          {children}
        </tbody>
      </table>
    );
  }
);

export const Table = Object.assign(TableRoot, {
  Row,
  Cell,
  HeaderRow,
  HeaderCell,
});
