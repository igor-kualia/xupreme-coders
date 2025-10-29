import OpenAI from 'openai';
import { parseCategoryFromLLM } from './helpers';

export interface MerchantToCategorizeLLM {
  merchantId: string | null;
  merchantName: string;
}

export interface CategoryInfo {
  name: string; // e.g., "Groceries"
  groupName: string; // e.g., "Food & Dining"
  formattedName: string; // e.g., "[Food & Dining][Groceries]"
}

export interface LLMCategorizationResult {
  merchantName: string;
  categoryName: string; // Format: "[Group][Category]"
  confidence: number;
}

export interface ParsedLLMResult {
  merchantName: string;
  categoryName: string;
  groupName: string | null;
  confidence: number;
}

/**
 * Build categorization prompt for LLM
 */
export function buildCategorizationPrompt(
  merchants: MerchantToCategorizeLLM[],
  categories: CategoryInfo[],
): string {
  // Format categories list
  const categoriesList = categories
    .map((cat) => cat.formattedName)
    .sort()
    .join('\n');

  // Format merchant list
  const merchantList = merchants.map((m, idx) => `${idx + 1}. ${m.merchantName}`).join('\n');

  return `You are a financial transaction categorization API. Return ONLY valid JSON.

Available categories:
${categoriesList}

Merchants to categorize:
${merchantList}

Return a JSON array matching each merchant to a category. Use this exact format:
[
  {
    "merchantName": "Whole Foods Market",
    "categoryName": "[Food & Dining][Groceries]",
    "confidence": 0.95
  }
]

Rules:
- Return ONLY the JSON array (start with [ and end with ])
- No explanations, no markdown, no code blocks
- Use ONLY categories from the list above
- Confidence: 0.0 to 1.0
- If uncertain, use lower confidence

JSON array:`;
}

/**
 * Call OpenRouter API with categorization prompt
 */
export async function callOpenRouter(apiKey: string, prompt: string): Promise<string> {
  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env['CONVEX_SITE_URL'] ?? 'http://localhost:4200',
      'X-Title': 'XupremeCoders Transaction Categorization',
    },
  });

  const completion = await openai.chat.completions.create({
    model: '@preset/xupreme-coders-categorization',
    messages: [
      {
        role: 'system',
        content:
          'You are a JSON API that categorizes merchants. Always respond with valid JSON arrays only, never with explanatory text.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3, // Lower temperature for more consistent JSON output
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from LLM');
  }

  return content;
}

/**
 * Parse and validate LLM response
 */
export function parseLLMResponse(response: string): ParsedLLMResult[] {
  let jsonContent = response.trim();

  // Remove markdown code blocks if present
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
  }

  // Try to extract JSON array if there's explanatory text before/after
  const jsonArrayMatch = jsonContent.match(/\[[\s\S]*\]/);
  if (jsonArrayMatch) {
    jsonContent = jsonArrayMatch[0];
  }

  // Clean up any leading/trailing text
  jsonContent = jsonContent.trim();

  let llmResults: LLMCategorizationResult[];
  try {
    llmResults = JSON.parse(jsonContent);
  } catch (error) {
    // Log the actual response for debugging
    console.error('Failed to parse LLM response. Raw response:', response.substring(0, 200));
    throw new Error(`Failed to parse LLM response as JSON: ${error}`);
  }

  if (!Array.isArray(llmResults)) {
    throw new Error('LLM response is not an array');
  }

  // Parse and validate each result
  const parsedResults: ParsedLLMResult[] = [];
  for (const result of llmResults) {
    if (!result.merchantName || !result.categoryName) {
      console.warn('Skipping invalid result (missing merchantName or categoryName):', result);
      continue;
    }

    const { categoryName, groupName } = parseCategoryFromLLM(result.categoryName);

    parsedResults.push({
      merchantName: result.merchantName,
      categoryName,
      groupName,
      confidence: result.confidence ?? 0.5,
    });
  }

  return parsedResults;
}

/**
 * Categorize merchants using LLM (main entry point)
 */
export async function categorizeMerchantsWithLLM(
  apiKey: string,
  merchants: MerchantToCategorizeLLM[],
  categories: CategoryInfo[],
): Promise<ParsedLLMResult[]> {
  if (merchants.length === 0) {
    return [];
  }

  const prompt = buildCategorizationPrompt(merchants, categories);
  const response = await callOpenRouter(apiKey, prompt);
  return parseLLMResponse(response);
}
