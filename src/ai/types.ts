import { z } from 'zod';

/**
 * @fileOverview This file contains shared Zod schemas and TypeScript types for AI flows.
 */

// GradeDocument flow types
export const GradeDocumentInputSchema = z.object({
  question: z.string().describe('The question that was asked.'),
  answer: z.string().describe('The answer text to be graded.'),
  rubric: z.string().describe('The grading rubric or criteria.'),
  keywords: z.string().optional().describe('Optional keywords to look for.'),
});
export type GradeDocumentInput = z.infer<typeof GradeDocumentInputSchema>;

export const GradeDocumentOutputSchema = z.object({
  analysis: z.array(
    z.object({
      id: z.string().describe('A unique ID for the highlighted segment.'),
      segment: z.string().describe('The highlighted portion of the answer text.'),
      comment: z.string().describe('The AI-generated comment explaining why this segment was highlighted.'),
    })
  ).describe('An array of text segments from the answer that are noteworthy, along with comments.'),
  overallFeedback: z.string().describe('A summary of the overall feedback.'),
});
export type GradeDocumentOutput = z.infer<typeof GradeDocumentOutputSchema>;


// SemanticFormat flow types
export const SemanticFormatInputSchema = z.object({
    text: z.string().describe('The text to be semantically formatted.'),
    style: z
      .string()
      .optional()
      .describe(
        'The style to use for formatting the text, such as document, report, email, etc. Defaults to document if not provided.'
      ),
  });
export type SemanticFormatInput = z.infer<typeof SemanticFormatInputSchema>;
  
export const SemanticFormatOutputSchema = z.object({
    formattedText: z.string().describe('The semantically formatted text.'),
});
export type SemanticFormatOutput = z.infer<typeof SemanticFormatOutputSchema>;


// ApplyStyle flow types
export const ApplyStyleInputSchema = z.object({
    text: z.string().describe('The text to be formatted.'),
    style: z.string().describe('The style to apply to the text.'),
});
export type ApplyStyleInput = z.infer<typeof ApplyStyleInputSchema>;
  
export const ApplyStyleOutputSchema = z.object({
    formattedText: z.string().describe('The text formatted with the selected style.'),
});
export type ApplyStyleOutput = z.infer<typeof ApplyStyleOutputSchema>;
