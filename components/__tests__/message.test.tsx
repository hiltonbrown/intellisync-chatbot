import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ComponentProps, ReactNode } from 'react';
import { DataStreamProvider } from '../data-stream-provider';
import { PreviewMessage } from '../message';
import type { ChatMessage, ChatTools } from '@/lib/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: ReactNode }) => <pre>{children}</pre>,
}));

vi.mock('streamdown', () => ({
  Streamdown: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('server-only', () => ({}));

vi.mock('../message-actions', () => ({
  MessageActions: () => null,
}));

vi.mock('../message-editor', () => ({
  MessageEditor: () => null,
}));

type AnalyzeEmailFraudPart = Extract<
  ChatMessage['parts'][number],
  { type: 'tool-analyzeEmailFraud' }
>;

type AnalyzeEmailFraudInputPart = Extract<
  AnalyzeEmailFraudPart,
  { state: 'input-available' }
>;

type AnalyzeEmailFraudOutputPart = Extract<
  AnalyzeEmailFraudPart,
  { state: 'output-available' }
>;

type AnalyzeEmailFraudErrorPart = Extract<
  AnalyzeEmailFraudPart,
  { state: 'output-error' }
>;

type AnalyzeEmailFraudOutputErrorPart = AnalyzeEmailFraudOutputPart & {
  output: { error: string };
};

type AnalyzeEmailFraudInput = ChatTools['analyzeEmailFraud']['input'];

type AnalyzeEmailFraudOutput = ChatTools['analyzeEmailFraud']['output'];

const baseInput: AnalyzeEmailFraudInput = {
  senderEmail: 'fraudster@example.com',
  senderName: 'Fraudster, Inc.',
  subject: 'Important account update',
  emailBody:
    'We detected unusual activity. Please click the link and verify your credentials immediately or your account will be closed.',
  analysisDepth: 'detailed',
};

const renderWithProviders = (message: ChatMessage) =>
  render(
    <DataStreamProvider>
      <PreviewMessage
        chatId="chat-1"
        message={message}
        vote={undefined}
        isLoading={false}
        setMessages={vi.fn()}
        regenerate={vi.fn()}
        isReadonly={true}
        requiresScrollPadding={false}
        isArtifactVisible={false}
      />
    </DataStreamProvider>,
  );

const createMessage = (part: AnalyzeEmailFraudPart): ChatMessage => ({
  id: `message-${part.state}`,
  role: 'assistant',
  metadata: { createdAt: '2024-01-01T00:00:00.000Z' },
  parts: [part],
});

const createInputPart = (): AnalyzeEmailFraudInputPart => ({
  type: 'tool-analyzeEmailFraud',
  toolCallId: 'call-input',
  state: 'input-available',
  input: baseInput,
});

const createPhaseOneOutput = (): AnalyzeEmailFraudOutput => ({
  phase: 1,
  title: 'Phase 1: Self-check guidance',
  introduction: 'Review these checks before escalating to AI analysis.',
  steps: [
    {
      title: 'Validate the sender domain',
      checks: ['Compare the sender email domain with the official domain.'],
      action: 'Check the sender email domain',
      importance: 'HIGH',
    },
  ],
  riskAssessment: {
    low: '0-1 red flags present',
    medium: '2-3 red flags present',
    high: '4 or more red flags',
  },
  nextAction: 'Collect the email headers and any suspicious URLs for phase two.',
});

const createPhaseOnePart = (): AnalyzeEmailFraudOutputPart => ({
  type: 'tool-analyzeEmailFraud',
  toolCallId: 'call-phase-one',
  state: 'output-available',
  input: baseInput,
  output: createPhaseOneOutput(),
});

const createPhaseTwoOutput = (): AnalyzeEmailFraudOutput => ({
  phase: 2,
  riskLevel: 'HIGH',
  confidence: 87,
  findings: [
    {
      category: 'Sender authenticity',
      indicator: 'Domain mismatch',
      severity: 'HIGH',
      evidence:
        'Sender domain "fraudster.com" differs from the official domain and SPF validation failed.',
      explanation:
        'The sender domain does not match the legitimate organization and fails authentication checks.',
    },
  ],
  recommendations: [
    'Do not respond or click any links.',
    'Forward the message to the security team for investigation.',
  ],
  detailedReport:
    'Multiple fraud indicators detected including spoofed sender address and urgent social engineering language.',
  analyzedWith: 'fraud-analysis-model-test',
});

const createPhaseTwoPart = (): AnalyzeEmailFraudOutputPart => ({
  type: 'tool-analyzeEmailFraud',
  toolCallId: 'call-phase-two',
  state: 'output-available',
  input: baseInput,
  output: createPhaseTwoOutput(),
});

const createOutputErrorPart = (): AnalyzeEmailFraudOutputErrorPart => ({
  type: 'tool-analyzeEmailFraud',
  toolCallId: 'call-output-error',
  state: 'output-available',
  input: baseInput,
  output: { error: 'Analysis failed to complete.' } as any,
});

const createErrorPart = (): AnalyzeEmailFraudErrorPart => ({
  type: 'tool-analyzeEmailFraud',
  toolCallId: 'call-error',
  state: 'output-error',
  input: baseInput,
  errorText: 'Unable to reach the fraud analysis service.',
});

describe('PreviewMessage analyze email fraud tool rendering', () => {
  it('renders analyze email fraud parameters when input is available', () => {
    const message = createMessage(createInputPart());
    renderWithProviders(message);

    expect(screen.getByText(/Parameters/i)).toBeInTheDocument();
    expect(screen.getAllByText(/fraudster@example.com/i).length).toBeGreaterThan(0);
  });

  it('renders the phase one guidance output', () => {
    const message = createMessage(createPhaseOnePart());
    renderWithProviders(message);

    expect(screen.getByText('Phase 1: Self-check guidance')).toBeInTheDocument();
    expect(
      screen.getByText('Collect the email headers and any suspicious URLs for phase two.'),
    ).toBeInTheDocument();
  });

  it('renders the structured phase two report output', () => {
    const message = createMessage(createPhaseTwoPart());
    renderWithProviders(message);

    expect(screen.getByText(/HIGH risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Confidence: 87%/i)).toBeInTheDocument();
    expect(screen.getByText(/Domain mismatch/i)).toBeInTheDocument();
    expect(
      screen.getByText('Forward the message to the security team for investigation.'),
    ).toBeInTheDocument();
  });

  it('renders tool errors when analysis fails', () => {
    const message = createMessage(createErrorPart());
    renderWithProviders(message);

    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
    expect(screen.getByText(/Unable to reach the fraud analysis service./i)).toBeInTheDocument();
  });

  it('renders presentational error state when the tool output contains an error payload', () => {
    const message = createMessage(createOutputErrorPart());
    renderWithProviders(message);

    expect(screen.getByText(/Unable to display fraud analysis:/i)).toBeInTheDocument();
    expect(screen.getByText(/Analysis failed to complete./i)).toBeInTheDocument();
  });
});
