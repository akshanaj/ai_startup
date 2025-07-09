'use server';

/**
 * @fileOverview This file contains the Genkit flow for grading a document based on a rubric.
 *
 * - gradeDocument - A function that takes a question, answer, and rubric to generate feedback and a score.
 */

import {ai} from '@/ai/genkit';
import { GradeDocumentInput, GradeDocumentInputSchema, GradeDocumentOutput, GradeDocumentOutputSchema } from '@/ai/types';

export async function gradeDocument(input: GradeDocumentInput): Promise<GradeDocumentOutput> {
  return gradeDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'gradeDocumentPrompt',
  input: {schema: GradeDocumentInputSchema},
  output: {schema: GradeDocumentOutputSchema},
  prompt: `You are an expert teaching assistant. Your task is to grade a student's answer based on a given question and rubric. The rubric includes a total possible score.

  First, analyze the provided answer and identify key segments that directly relate to the rubric and question. For each segment you identify, you MUST provide a comment explaining its significance, how it meets (or fails to meet) the rubric, and what makes it stand out. 

  Crucially, for each segment, you must also determine the sentiment of your feedback. 
  - Use 'positive' if the segment is correct, well-explained, or aligns with the rubric.
  - Use 'negative' if the segment is inaccurate, misses key points, or contradicts the rubric.
  - Use 'neutral' for general observations or contextual comments that are neither strictly positive nor negative.
  
  Create a unique ID for each segment.

  After analyzing all segments, provide overall feedback on the answer.

  Finally, based on your analysis and the rubric, determine a score for the student's answer. The score should be an integer.

  **Question:**
  {{{question}}}

  **Grading Rubric:**
  {{{rubric}}}

  {{#if keywords}}
  **Keywords to consider:**
  {{{keywords}}}
  {{/if}}

  **Student's Answer:**
  {{{answer}}}
  `,
});

const gradeDocumentFlow = ai.defineFlow(
  {
    name: 'gradeDocumentFlow',
    inputSchema: GradeDocumentInputSchema,
    outputSchema: GradeDocumentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);

    if (!output) {
      throw new Error('The AI model did not return a valid response.');
    }

    // Ensure each analysis item has a unique ID.
    const analysisWithIds = output.analysis.map((item, index) => ({
      ...item,
      id: `segment-${index}-${Date.now()}`,
    }));
    
    return {
        ...output,
        analysis: analysisWithIds,
    };
  }
);
