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
