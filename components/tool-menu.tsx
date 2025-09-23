'use client';

import { useCallback, useMemo, useState } from 'react';
import { Wrench, Loader2, ChevronDown } from 'lucide-react';
import { toolDefinitions } from '@/lib/ai/tools/definitions';
import type { ToolDefinition, ToolFieldDefinition } from '@/lib/ai/tools/types';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from './ui/alert-dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { cn } from '@/lib/utils';

type ToolMenuProps = {
  disabled?: boolean;
  isLoading?: boolean;
  activeTool?: string | null;
  lastError?: string | null;
  onInvoke: (
    toolName: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onResetError?: () => void;
  definitions?: Array<ToolDefinition>;
};

type FormErrors = Record<string, string>;

type FormState = Record<string, unknown>;

function getInitialFieldValue(field: ToolFieldDefinition): unknown {
  switch (field.type) {
    case 'checkbox':
      return field.defaultValue ?? false;
    case 'select':
      return field.defaultValue ?? '';
    case 'tags':
      return Array.isArray(field.defaultValue)
        ? field.defaultValue.join('\n')
        : '';
    case 'text':
    case 'textarea':
    default:
      return field.defaultValue ?? '';
  }
}

function normaliseFieldValue(
  field: ToolFieldDefinition,
  value: unknown,
): unknown {
  switch (field.type) {
    case 'checkbox':
      return Boolean(value);
    case 'select':
      return value ?? '';
    case 'text':
    case 'textarea':
      if (field.inputType === 'number') {
        if (value === '' || value === null || value === undefined) {
          return undefined;
        }
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : value;
      }
      return value ?? '';
    case 'tags': {
      const raw = typeof value === 'string' ? value : '';
      return raw
        .split(/\n|,/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    default:
      return value;
  }
}

function getInitialFormState(tool: ToolDefinition): FormState {
  return tool.ui.fields.reduce<FormState>((state, field) => {
    state[field.name] = getInitialFieldValue(field);
    return state;
  }, {});
}

export function ToolMenu({
  disabled,
  isLoading,
  activeTool,
  lastError,
  onInvoke,
  onResetError,
  definitions = toolDefinitions,
}: ToolMenuProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [formState, setFormState] = useState<FormState>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const availableTools = useMemo(
    () => [...definitions].sort((a, b) => a.label.localeCompare(b.label)),
    [definitions],
  );

  const handleOpenDialog = useCallback(
    (definition: ToolDefinition) => {
      onResetError?.();
      setSelectedTool(definition);
      setFormState(getInitialFormState(definition));
      setFormErrors({});
      setSubmissionError(null);
      setIsDialogOpen(true);
    },
    [onResetError],
  );

  const handleDialogChange = useCallback((open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedTool(null);
      setFormState({});
      setFormErrors({});
      setSubmissionError(null);
    }
  }, []);

  const handleFieldChange = useCallback(
    (field: ToolFieldDefinition, value: unknown) => {
      setFormState((previous) => ({ ...previous, [field.name]: value }));
      setFormErrors((previous) => ({ ...previous, [field.name]: '' }));
    },
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedTool) return;

      const nextErrors: FormErrors = {};
      const normalisedInput: Record<string, unknown> = {};

      for (const field of selectedTool.ui.fields) {
        const value = formState[field.name];
        normalisedInput[field.name] = normaliseFieldValue(field, value);
      }

      const validation = selectedTool.inputSchema.safeParse(normalisedInput);

      if (!validation.success) {
        const flattened = validation.error.flatten();
        for (const [fieldName, messages] of Object.entries(
          flattened.fieldErrors,
        )) {
          if (messages && messages.length > 0) {
            nextErrors[fieldName] = messages[0];
          }
        }
        setFormErrors(nextErrors);
        setSubmissionError(flattened.formErrors?.[0] ?? null);
        return;
      }

      try {
        setSubmissionError(null);
        await onInvoke(selectedTool.name, validation.data);
        setIsDialogOpen(false);
      } catch (error) {
        setSubmissionError(
          error instanceof Error
            ? error.message
            : 'Failed to start the selected tool.',
        );
      }
    },
    [formState, onInvoke, selectedTool],
  );

  const isToolExecuting = Boolean(
    isLoading && selectedTool && selectedTool.name === activeTool,
  );

  const dialogError =
    selectedTool && selectedTool.name === activeTool ? lastError : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className='relative h-8 gap-1 rounded-lg bg-background px-2 font-medium text-xs'
            disabled={disabled || isLoading}
          >
            <Wrench className="size-4" />
            Tools
            <ChevronDown className="size-3" />
            {isLoading ? (
              <Badge
                variant="secondary"
                className='-top-1 -right-1 absolute px-1 text-[10px]'
              >
                <Loader2 className="mr-1 size-3 animate-spin" />
                Run
              </Badge>
            ) : null}
            {!isLoading && lastError ? (
              <Badge
                variant="destructive"
                className='-top-1 -right-1 absolute px-1 text-[10px]'
              >
                !
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Tools</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableTools.map((tool) => (
            <DropdownMenuItem
              key={tool.name}
              onSelect={(event) => {
                event.preventDefault();
                handleOpenDialog(tool);
              }}
              className="flex flex-col items-start gap-0.5 py-2"
            >
              <span className="font-medium text-sm">{tool.label}</span>
              <span className="text-muted-foreground text-xs">
                {tool.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <AlertDialogContent>
          {selectedTool ? (
            <form
              className="space-y-4"
              onSubmit={handleSubmit}
              noValidate
            >
              <AlertDialogHeader>
                <AlertDialogTitle>{selectedTool.label}</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedTool.description}
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-3">
                {selectedTool.ui.fields.map((field) => (
                  <div className="space-y-1" key={field.name}>
                    {field.type !== 'checkbox' ? (
                      <Label htmlFor={`tool-${field.name}`}>
                        {field.label}
                      </Label>
                    ) : null}
                    {field.type === 'text' ? (
                      <Input
                        id={`tool-${field.name}`}
                        type={field.inputType ?? 'text'}
                        value={String(formState[field.name] ?? '')}
                        onChange={(event) =>
                          handleFieldChange(field, event.target.value)
                        }
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    ) : null}
                    {field.type === 'textarea' ? (
                      <Textarea
                        id={`tool-${field.name}`}
                        value={String(formState[field.name] ?? '')}
                        onChange={(event) =>
                          handleFieldChange(field, event.target.value)
                        }
                        rows={field.rows ?? 4}
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    ) : null}
                    {field.type === 'select' ? (
                      <Select
                        value={
                          typeof formState[field.name] === 'string'
                            ? (formState[field.name] as string) || undefined
                            : field.defaultValue || undefined
                        }
                        onValueChange={(next) =>
                          handleFieldChange(field, next)
                        }
                        disabled={Boolean(isLoading)}
                      >
                        <SelectTrigger id={`tool-${field.name}`}>
                          <SelectValue placeholder={field.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {field.type === 'checkbox' ? (
                      <div className="flex items-center gap-2">
                        <input
                          id={`tool-${field.name}`}
                          type="checkbox"
                          className={cn(
                            'size-4 rounded border border-input bg-transparent accent-foreground',
                          )}
                          checked={Boolean(formState[field.name])}
                          onChange={(event) =>
                            handleFieldChange(field, event.target.checked)
                          }
                        />
                        <span className="text-muted-foreground text-sm">
                          {field.label}
                        </span>
                      </div>
                    ) : null}
                    {field.type === 'tags' ? (
                      <Textarea
                        id={`tool-${field.name}`}
                        value={String(formState[field.name] ?? '')}
                        onChange={(event) =>
                          handleFieldChange(field, event.target.value)
                        }
                        rows={field.defaultValue?.length ? 3 : 2}
                        placeholder={field.placeholder ?? 'Enter values'}
                      />
                    ) : null}
                    {field.helperText ? (
                      <p className="text-muted-foreground text-xs">
                        {field.helperText}
                      </p>
                    ) : null}
                    {formErrors[field.name] ? (
                      <p className="text-destructive text-xs">
                        {formErrors[field.name]}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              {submissionError || dialogError ? (
                <p className="text-destructive text-sm" role="alert">
                  {submissionError ?? dialogError}
                </p>
              ) : null}

              <AlertDialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isToolExecuting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  {selectedTool.ui.submitLabel ?? 'Run tool'}
                </Button>
              </AlertDialogFooter>
            </form>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

