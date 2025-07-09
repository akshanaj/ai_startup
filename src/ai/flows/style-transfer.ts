'use server';
/**
 * @fileOverview Applies a selected style to the input text.
 *
 * - applyStyle - A function that applies the selected style to the input text.
 */

import {ai} from '@/ai/genkit';
import { ApplyStyleInput, ApplyStyleInputSchema, ApplyStyleOutput, ApplyStyleOutputSchema } from '@/ai/types';

export async function applyStyle(input: ApplyStyleInput): Promise<ApplyStyleOutput> {
  return applyStyleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'applyStylePrompt',
  input: {schema: ApplyStyleInputSchema},
  output: {schema: ApplyStyleOutputSchema},
  prompt: `You are a document formatting expert. Please apply the following style to the text provided.

Style: {{{style}}}

Text: {{{text}}}

Formatted Text:`,
});

const applyStyleFlow = ai.defineFlow(
  {
    name: 'applyStyleFlow',
    inputSchema: ApplyStyleInputSchema,
    outputSchema: ApplyStyleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
