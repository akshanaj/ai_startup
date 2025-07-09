'use server';

/**
 * @fileOverview This file contains the Genkit flow for semantic formatting of text.
 *
 * - semanticFormat - A function that takes text as input and returns semantically formatted text.
 */

import {ai} from '@/ai/genkit';
import { SemanticFormatInput, SemanticFormatInputSchema, SemanticFormatOutput, SemanticFormatOutputSchema } from '@/ai/types';


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
