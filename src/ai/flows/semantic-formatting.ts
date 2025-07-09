'use server';

/**
 * @fileOverview This file contains the Genkit flow for semantic formatting of text.
 *
 * - semanticFormat - A function that takes text as input and returns semantically formatted text.
 * - SemanticFormatInput - The input type for the semanticFormat function.
 * - SemanticFormatOutput - The return type for the semanticFormat function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticFormatInputSchema = z.object({
  text: z.string().describe('The text to be semantically formatted.'),
  style: z
    .string()
    .optional()
    .describe(
      'The style to use for formatting the text, such as document, report, email, etc. Defaults to document if not provided.'
    ),
});
export type SemanticFormatInput = z.infer<typeof SemanticFormatInputSchema>;

const SemanticFormatOutputSchema = z.object({
  formattedText: z.string().describe('The semantically formatted text.'),
});
export type SemanticFormatOutput = z.infer<typeof SemanticFormatOutputSchema>;

export async function semanticFormat(input: SemanticFormatInput): Promise<SemanticFormatOutput> {
  return semanticFormatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'semanticFormatPrompt',
  input: {schema: SemanticFormatInputSchema},
  output: {schema: SemanticFormatOutputSchema},
  prompt: `You are an AI expert in text formatting.  You will receive text as input, and you will return a formatted version of that text based on semantic content.

The user has selected the "{{style}}" style, so format the document accordingly.

Original Text: {{{text}}}`,
});

const semanticFormatFlow = ai.defineFlow(
  {
    name: 'semanticFormatFlow',
    inputSchema: SemanticFormatInputSchema,
    outputSchema: SemanticFormatOutputSchema,
  },
  async input => {
    // Default style if not provided
    const style = input.style || 'document';

    const {output} = await prompt({...input, style});
    return output!;
  }
);
