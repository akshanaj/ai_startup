'use server';
/**
 * @fileOverview Applies a selected style to the input text.
 *
 * - applyStyle - A function that applies the selected style to the input text.
 * - ApplyStyleInput - The input type for the applyStyle function.
 * - ApplyStyleOutput - The return type for the applyStyle function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ApplyStyleInputSchema = z.object({
  text: z.string().describe('The text to be formatted.'),
  style: z.string().describe('The style to apply to the text.'),
});
export type ApplyStyleInput = z.infer<typeof ApplyStyleInputSchema>;

const ApplyStyleOutputSchema = z.object({
  formattedText: z.string().describe('The text formatted with the selected style.'),
});
export type ApplyStyleOutput = z.infer<typeof ApplyStyleOutputSchema>;

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
