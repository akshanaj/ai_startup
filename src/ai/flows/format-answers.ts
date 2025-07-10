'use server';

/**
 * @fileOverview A Genkit flow to format unstructured student answers into a specific format.
 * - formatAnswers - A function that takes a raw text block of answers and formats it.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const FormatAnswersInputSchema = z.object({
  rawText: z.string().describe('The raw, unstructured text containing student names and their answers.'),
});
type FormatAnswersInput = z.infer<typeof FormatAnswersInputSchema>;

const FormatAnswersOutputSchema = z.object({
  formattedText: z.string().describe('The text formatted into the specified structure.'),
});
type FormatAnswersOutput = z.infer<typeof FormatAnswersOutputSchema>;


export async function formatAnswers(rawText: string): Promise<string> {
  const result = await formatAnswersFlow({ rawText });
  return result.formattedText;
}

const prompt = ai.definePrompt({
  name: 'formatAnswersPrompt',
  input: { schema: FormatAnswersInputSchema },
  output: { schema: FormatAnswersOutputSchema },
  prompt: `You are a text formatting expert. Your task is to reformat the provided text into a specific structure.

The user will provide a block of text that might be messy. It contains student names and their answers. You need to identify each student and their corresponding answers and format them as follows:

- Each student's name should be on its own line.
- Each answer for that student should be on a new line immediately following the name, prefixed with a "•" (bullet point) and a space.
- There should be a blank line between each student's block of answers.

**Example Input:**
"Alice Smith Q1: Photosynthesis is... Answer 2: Mitochondria are... Bob Jones, his first answer is that plants make food. And the second one is that mitochondria make energy."

**Example Output:**
Alice Smith
• Photosynthesis is...
• Mitochondria are...

Bob Jones
• his first answer is that plants make food.
• And the second one is that mitochondria make energy.

Now, please format the following text:

{{{rawText}}}
`,
});

const formatAnswersFlow = ai.defineFlow(
  {
    name: 'formatAnswersFlow',
    inputSchema: FormatAnswersInputSchema,
    outputSchema: FormatAnswersOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('The AI model did not return a valid formatted response.');
    }
    return output;
  }
);
