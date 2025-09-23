'use client';

import { Badge } from '@/components/ui/badge';
import type { ChatTools } from '@/lib/types';
import { cn } from '@/lib/utils';

type AnalyzeEmailFraudOutput = ChatTools['analyzeEmailFraud']['output'];

type PhaseOneStep = {
  title: string;
  checks?: string[];
  redFlags?: string[];
  action?: string;
  importance?: string;
};

type PhaseOneGuidance = {
  phase: 1;
  title: string;
  introduction: string;
  steps: PhaseOneStep[];
  riskAssessment?: Record<string, string>;
  nextAction: string;
};

type PhaseTwoFinding = {
  category: string;
  indicator: string;
  severity: string;
  evidence: string;
  explanation: string;
};

type PhaseTwoReport = {
  phase: 2;
  riskLevel: string;
  confidence: number;
  findings?: PhaseTwoFinding[];
  recommendations?: string[];
  detailedReport?: string;
  analyzedWith?: string;
};

type ErrorResult = { error: unknown };

type EmailFraudResult = PhaseOneGuidance | PhaseTwoReport;

const severityStyles: Record<string, string> = {
  LOW: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300',
  MEDIUM: 'border-amber-500/40 text-amber-600 dark:text-amber-200',
  HIGH: 'border-orange-500/40 text-orange-600 dark:text-orange-200',
  CRITICAL: 'border-red-500/40 text-red-600 dark:text-red-300',
};

const riskStyles: Record<string, string> = {
  LOW: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200',
  MEDIUM: 'bg-amber-500/15 text-amber-700 dark:text-amber-200',
  HIGH: 'bg-orange-500/15 text-orange-700 dark:text-orange-200',
  CRITICAL: 'bg-red-500/15 text-red-700 dark:text-red-300',
  UNKNOWN: 'bg-muted text-foreground',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasError = (value: unknown): value is ErrorResult =>
  isRecord(value) && 'error' in value;

const isPhaseOneGuidance = (value: unknown): value is PhaseOneGuidance =>
  isRecord(value) &&
  value.phase === 1 &&
  typeof value.title === 'string' &&
  typeof value.introduction === 'string' &&
  Array.isArray(value.steps) &&
  typeof value.nextAction === 'string';

const isPhaseTwoReport = (value: unknown): value is PhaseTwoReport =>
  isRecord(value) &&
  value.phase === 2 &&
  typeof value.riskLevel === 'string' &&
  typeof value.confidence === 'number';

const createStepKey = (step: PhaseOneStep) =>
  [step.title, step.action, step.importance]
    .filter((part): part is string => Boolean(part))
    .join('|');

const PhaseOneGuidanceView = ({
  guidance,
}: {
  guidance: PhaseOneGuidance;
}) => (
  <div className="space-y-4 text-sm">
    <div className="space-y-2">
      <h5 className="font-semibold text-base leading-tight">{guidance.title}</h5>
      <p className="whitespace-pre-wrap text-muted-foreground">
        {guidance.introduction}
      </p>
    </div>

    <div className="space-y-3">
      {guidance.steps.map((step) => {
        const stepKey = createStepKey(step) || step.title;

        return (
          <div
            key={stepKey}
            className="space-y-2 rounded-md border border-border bg-background/70 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-sm">{step.title}</span>
              {step.importance ? (
                <Badge
                  className="rounded-full border-primary/40 text-primary text-xs uppercase tracking-wide"
                  variant="outline"
                >
                  {step.importance}
                </Badge>
              ) : null}
            </div>

            {step.checks?.length ? (
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                {step.checks.map((check) => (
                  <li key={`${step.title}-check-${check}`}>{check}</li>
                ))}
              </ul>
            ) : null}

            {step.redFlags?.length ? (
              <div className="space-y-1">
                <p className="font-semibold text-destructive text-xs uppercase">
                  Red flags
                </p>
                <ul className="ml-4 list-disc space-y-1 text-destructive">
                  {step.redFlags.map((flag) => (
                    <li key={`${step.title}-flag-${flag}`}>{flag}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {step.action ? (
              <p className="text-muted-foreground text-xs">
                <span className="font-semibold text-foreground">Action:</span>{' '}
                {step.action}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>

    {guidance.riskAssessment ? (
      <div className="space-y-2 rounded-md border border-muted-foreground/40 border-dashed bg-muted/40 p-3">
        <h6 className="font-semibold text-xs uppercase tracking-wide">
          Risk assessment
        </h6>
        <ul className="space-y-1 text-muted-foreground">
          {Object.entries(guidance.riskAssessment).map(([level, description]) => (
            <li
              key={level}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2"
            >
              <span className="font-semibold text-foreground uppercase">
                {level}
              </span>
              <span className="text-muted-foreground">{description}</span>
            </li>
          ))}
        </ul>
      </div>
    ) : null}

    <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
      <p className="font-semibold text-primary text-sm">Next action</p>
      <p className="mt-1 text-primary text-sm">{guidance.nextAction}</p>
    </div>
  </div>
);

const createFindingKey = (finding: PhaseTwoFinding) =>
  [finding.category, finding.indicator, finding.severity]
    .filter((part): part is string => Boolean(part))
    .join('|');

const PhaseTwoReportView = ({ report }: { report: PhaseTwoReport }) => (
  <div className="space-y-4 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        className={cn(
          'rounded-full text-xs uppercase tracking-wide',
          riskStyles[report.riskLevel] ?? riskStyles.UNKNOWN,
        )}
        variant="secondary"
      >
        {report.riskLevel} risk
      </Badge>
      <span className="text-muted-foreground">
        Confidence: {Math.round(report.confidence)}%
      </span>
      {report.analyzedWith ? (
        <span className="text-muted-foreground text-xs">
          Model: {report.analyzedWith}
        </span>
      ) : null}
    </div>

    {report.findings?.length ? (
      <div className="space-y-3">
        <h6 className="font-semibold text-xs uppercase tracking-wide">
          Key findings
        </h6>
        <div className="space-y-3">
          {report.findings.map((finding) => (
            <div
              key={createFindingKey(finding) || finding.category}
              className="space-y-2 rounded-md border border-border bg-background/70 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-sm">{finding.category}</span>
                <Badge
                  className={cn(
                    'rounded-full border text-xs uppercase tracking-wide',
                    severityStyles[finding.severity] ?? '',
                  )}
                  variant="outline"
                >
                  {finding.severity}
                </Badge>
              </div>
              <p className="font-medium text-sm">{finding.indicator}</p>
              <p className="whitespace-pre-wrap text-muted-foreground text-sm">
                {finding.evidence}
              </p>
              <p className="text-muted-foreground text-sm">{finding.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    ) : null}

    {report.recommendations?.length ? (
      <div className="space-y-2">
        <h6 className="font-semibold text-xs uppercase tracking-wide">
          Recommendations
        </h6>
        <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
          {report.recommendations.map((recommendation) => (
            <li key={recommendation}>{recommendation}</li>
          ))}
        </ul>
      </div>
    ) : null}

    {report.detailedReport ? (
      <div className="space-y-2">
        <h6 className="font-semibold text-xs uppercase tracking-wide">
          Detailed report
        </h6>
        <p className="whitespace-pre-wrap text-muted-foreground text-sm">
          {report.detailedReport}
        </p>
      </div>
    ) : null}
  </div>
);

export type EmailFraudAnalysisResultProps = {
  result: AnalyzeEmailFraudOutput | EmailFraudResult | ErrorResult | undefined;
};

export const EmailFraudAnalysisResult = ({
  result,
}: EmailFraudAnalysisResultProps) => {
  if (!result) {
    return null;
  }

  const payload = result as unknown;

  if (hasError(payload)) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
        Unable to display fraud analysis: {String(payload.error)}
      </div>
    );
  }

  if (isPhaseOneGuidance(payload)) {
    return <PhaseOneGuidanceView guidance={payload} />;
  }

  if (isPhaseTwoReport(payload)) {
    return <PhaseTwoReportView report={payload} />;
  }

  return (
    <div className="rounded-md border border-muted-foreground/30 bg-muted/30 p-3 text-muted-foreground">
      Fraud analysis result is not available.
    </div>
  );
};
