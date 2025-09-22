import { tool, generateObject } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

const analyzeEmailFraudInput = z.object({
  // Basic email metadata
  senderEmail: z.string().email('Please provide a valid sender email address'),
  senderName: z.string().min(1, "Please provide the sender's display name"),
  subject: z.string().min(1, 'Please provide the email subject'),

  // Email content
  emailBody: z.string().min(10, 'Please provide the email body content'),

  // Optional technical details
  receivedHeaders: z.string().optional(),
  links: z.array(z.string().url()).optional(),
  hasAttachments: z.boolean().optional(),

  // User observations
  userFlags: z.array(z.string()).optional(),
  urgencyLevel: z.enum(['low', 'medium', 'high']).optional(),
  requestsPersonalInfo: z.boolean().optional(),

  // Analysis preferences
  analysisDepth: z
    .enum(['basic', 'detailed', 'comprehensive'])
    .default('detailed'),
});

function getPhase1Guidance() {
  return {
    phase: 1,
    title: '🔍 EMAIL FRAUD ANALYSIS - PHASE 1: SELF-CHECK',
    introduction:
      "Before proceeding to AI analysis, let's check some basic indicators you can verify yourself. This helps you learn fraud detection patterns.",
    steps: [
      {
        title: '📧 Sender Verification',
        checks: [
          "Does the email address match the organization's official domain?",
          'Look for slight variations (bankofamerica-support.com vs bankofamerica.com)',
          'Check for random numbers or characters in the email address',
          'Verify if the sender name matches the email address',
        ],
        action: 'Right-click sender → Copy email address',
        importance: 'HIGH',
      },
      {
        title: '🔍 Header Inspection',
        checks: [
          'View email source/headers to check routing',
          "Compare 'From' header with display name",
          'Look for routing through suspicious countries or servers',
          'Check if email passed SPF/DKIM/DMARC validation',
        ],
        action:
          'Gmail: ⋮ → Show original | Outlook: File → Properties → Internet headers',
        importance: 'HIGH',
      },
      {
        title: '📝 Content Analysis',
        redFlags: [
          "Creates false urgency ('Act immediately!' 'Account suspended!')",
          'Requests sensitive information (passwords, SSN, banking details)',
          "Contains threats ('Account will be closed')",
          'Promises unrealistic rewards or prizes',
          'Poor grammar or unusual language patterns',
          'Generic greetings instead of your name',
        ],
        importance: 'MEDIUM',
      },
      {
        title: '🔗 Link & Attachment Check',
        checks: [
          'Hover over links - do URLs match displayed text?',
          'Check for shortened URLs (bit.ly, tinyurl, etc.)',
          'Unexpected attachments from unknown senders?',
          'Links point to HTTPS websites?',
        ],
        action: 'Hover over links without clicking',
        importance: 'HIGH',
      },
    ],
    riskAssessment: {
      low: '0-1 red flags found',
      medium: '2-3 red flags found',
      high: '4+ red flags found',
    },
    nextAction:
      'If you found multiple red flags, provide the email details below for Phase 2 AI analysis. Include email headers and any suspicious links.',
  };
}

async function performFraudAnalysis(
  input: any,
  selectedModel: string,
  providerClient: any,
) {
  const analysisSchema = z.object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    confidence: z.number().min(0).max(100),
    findings: z.array(
      z.object({
        category: z.string(),
        indicator: z.string(),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        evidence: z.string(),
        explanation: z.string(),
      }),
    ),
    recommendations: z.array(z.string()),
    detailedReport: z.string(),
  });

  try {
    const result = await generateObject({
      model: providerClient.languageModel(selectedModel),
      schema: analysisSchema,
      prompt: `You are an expert email fraud analyst. Analyze this email for fraud indicators and provide a comprehensive assessment.

EMAIL DETAILS:
- Sender: ${input.senderName} <${input.senderEmail}>
- Subject: ${input.subject}
- Content: ${input.emailBody}
${input.receivedHeaders ? `- Headers: ${input.receivedHeaders}` : ''}
${input.links ? `- Links found: ${input.links.join(', ')}` : ''}
${input.hasAttachments ? '- Contains attachments: Yes' : '- Contains attachments: No'}
${input.userFlags ? `- User observations: ${input.userFlags.join(', ')}` : ''}
${input.urgencyLevel ? `- Urgency level: ${input.urgencyLevel}` : ''}
${input.requestsPersonalInfo ? '- Requests personal info: Yes' : '- Requests personal info: No'}

ANALYSIS REQUIREMENTS:
1. Assess overall fraud risk level (LOW/MEDIUM/HIGH/CRITICAL)
2. Provide confidence percentage (0-100%)
3. List specific findings with evidence from the email
4. Explain technical indicators if headers provided
5. Check for social engineering tactics
6. Evaluate link safety if URLs provided
7. Provide actionable recommendations

Focus on concrete evidence from the email content, headers, and technical indicators.`,
      temperature: 0.1,
    });

    return result.object;
  } catch (error) {
    console.error('Email fraud analysis error:', error);
    return {
      riskLevel: 'UNKNOWN' as const,
      confidence: 0,
      findings: [],
      recommendations: ['Unable to complete analysis. Please try again.'],
      detailedReport: 'Analysis failed due to technical error.',
    };
  }
}

export const analyzeEmailFraud = ({
  selectedModel,
  providerClient,
}: ToolContext) =>
  tool({
    description: `Comprehensive email fraud analysis tool. Provides step-by-step guidance for users to check suspicious emails and performs AI-powered fraud risk assessment using the selected model (${selectedModel}).`,
    inputSchema: analyzeEmailFraudInput,
    execute: async (input) => {
      // Phase 1: Return guidance if basic info only
      if (!input.receivedHeaders && !input.links && !input.userFlags) {
        return getPhase1Guidance();
      }

      // Phase 2: AI Analysis
      const analysis = await performFraudAnalysis(
        input,
        selectedModel,
        providerClient,
      );

      return {
        phase: 2,
        riskLevel: analysis.riskLevel,
        confidence: analysis.confidence,
        findings: analysis.findings,
        recommendations: analysis.recommendations,
        detailedReport: analysis.detailedReport,
        analyzedWith: selectedModel,
      };
    },
  });
