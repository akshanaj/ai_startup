import { z } from 'zod';

/**
 * @fileOverview This file contains shared Zod schemas and TypeScript types for AI flows.
 */

// GradeDocument flow types
export const GradeDocumentInputSchema = z.object({
  question: z.string().describe('The question that was asked.'),
  answer: z.string().describe('The answer text to be graded.'),
  rubric: z.string().describe('The grading rubric or criteria, which should include the total possible points (e.g., "out of 10 points").'),
  keywords: z.string().optional().describe('Optional keywords to look for.'),
  studentId: z.string().describe('The ID of the student being graded.'),
  questionId: z.string().describe('The ID of the question being graded.'),
});
export type GradeDocumentInput = z.infer<typeof GradeDocumentInputSchema>;

export const GradeDocumentOutputSchema = z.object({
  analysis: z.array(
    z.object({
      id: z.string().describe('A unique ID for the highlighted segment.'),
      segment: z.string().describe('The highlighted portion of the answer text.'),
      comment: z.string().describe('The AI-generated comment explaining why this segment was highlighted.'),
      sentiment: z.enum(['positive', 'negative', 'neutral']).describe("The sentiment of the comment. Use 'positive' for correct points, 'negative' for inaccuracies, and 'neutral' for general observations."),
    })
  ).describe('An array of text segments from the answer that are noteworthy, along with comments.'),
  overallFeedback: z.string().describe('A summary of the overall feedback.'),
  score: z.number().describe("The student's score based on the rubric."),
});
export type GradeDocumentOutput = z.infer<typeof GradeDocumentOutputSchema>;


// ChatWithDocument flow types
export const ChatWithDocumentInputSchema = z.object({
  document: GradeDocumentInputSchema.describe("The original document and grading criteria."),
  currentAnalysis: GradeDocumentOutputSchema.describe("The current analysis and grade of the document."),
  userMessage: z.string().describe("The user's message or request to refine the analysis."),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'model']),
    message: z.string(),
  })).describe("The history of the conversation so far."),
});
export type ChatWithDocumentInput = z.infer<typeof ChatWithDocumentInputSchema>;

export const ChatWithDocumentOutputSchema = z.object({
  llmResponse: z.string().describe("The chatbot's text response to the user's message."),
  updatedAnalysis: GradeDocumentOutputSchema.describe("The new, updated grading analysis based on the user's request. This should be a complete analysis object, not just a delta."),
});
export type ChatWithDocumentOutput = z.infer<typeof ChatWithDocumentOutputSchema>;
