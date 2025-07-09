'use server';

/**
 * @fileOverview This file contains the Genkit flow for chatting with the AI to refine the document grading.
 * - chatWithDocument - A function that takes the current document, analysis, and a user message to get a refined analysis.
 */

import { ai } from '@/ai/genkit';
import {
  ChatWithDocumentInput,
  ChatWithDocumentInputSchema,
  ChatWithDocumentOutputSchema,
} from '@/ai/types';

export async function chatWithDocument(input: ChatWithDocumentInput) {
  return chatWithDocumentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'chatWithDocumentPrompt',
  input: { schema: ChatWithDocumentInputSchema },
  output: { schema: ChatWithDocumentOutputSchema },
  prompt: `You are a teaching assistant chatbot. The user has provided a document, a rubric, and an answer, which you have already graded.
  The user now wants to discuss and refine your analysis.

  Your task is to respond to the user's message and, if necessary, provide a complete, updated analysis of the document based on their feedback.

  **Original Context:**
  - Question: {{{document.question}}}
  - Rubric: {{{document.rubric}}}
  - Answer: {{{document.answer}}}
  {{#if document.keywords}}
  - Keywords: {{{document.keywords}}}
  {{/if}}

  **Current Analysis You Provided:**
  - Score: {{currentAnalysis.score}}
  - Overall Feedback: "{{currentAnalysis.overallFeedback}}"
  - Segment Analysis:
  {{#each currentAnalysis.analysis}}
    - Segment: "{{segment}}" | Comment: "{{comment}}" | Sentiment: {{sentiment}}
  {{/each}}

  **Conversation History:**
  {{#each chatHistory}}
    - {{role}}: {{message}}
  {{/each}}

  **User's New Message:**
  "{{{userMessage}}}"

  **Your Instructions:**
  1.  **Formulate a chat response:** Directly address the user's message in the 'llmResponse' field. Acknowledge their feedback.
  2.  **Generate an updated analysis:** Based on the user's request, re-evaluate the entire document and generate a brand new, complete analysis in the 'updatedAnalysis' field.
      - If the user's request doesn't require a change in the grading (e.g., they are just asking a question), return the 'currentAnalysis' as the 'updatedAnalysis'.
      - If the user's request *does* require a change, create a new analysis from scratch. The 'updatedAnalysis' must be a complete object adhering to the schema, not a partial update.
      - Ensure the comments in the new analysis are concise and to the point.
      - The score, feedback, and segments should all be updated to reflect the user's request.
`,
});

const chatWithDocumentFlow = ai.defineFlow(
  {
    name: 'chatWithDocumentFlow',
    inputSchema: ChatWithDocumentInputSchema,
    outputSchema: ChatWithDocumentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('The AI model did not return a valid response for the chat.');
    }

    // Ensure each analysis item in the updated analysis has a unique ID.
    const analysisWithIds = output.updatedAnalysis.analysis.map((item, index) => ({
      ...item,
      id: `segment-${index}-${Date.now()}`,
    }));

    return {
      ...output,
      updatedAnalysis: {
        ...output.updatedAnalysis,
        analysis: analysisWithIds,
      }
    };
  }
);
