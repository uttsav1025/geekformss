// Type declarations for the shared survey domain module (src/index.js).
// The implementation stays plain JS so the Vite client imports it unchanged;
// these types let the TypeScript server use it with full checking.

export type QuestionType = 'text' | 'single' | 'multi' | 'rating';
export type Operator = 'equals' | 'not_equals' | 'includes' | 'not_includes' | 'gte' | 'lte' | 'answered' | 'not_answered';

export interface Option {
  id: string;
  label: string;
}

export interface Condition {
  questionId: string;
  operator: Operator;
  value?: string | number;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  description?: string;
  required: boolean;
  options?: Option[];
  multiline?: boolean;
  maxLength?: number;
  condition?: Condition | null;
}

export interface SurveySchema {
  questions: Question[];
}

/** Answers keyed by question id: string (text / single), string[] (multi), number (rating). */
export type Answers = Record<string, unknown>;

export interface SchemaError {
  message: string;
  questionId?: string;
  path?: string;
}

export const QUESTION_TYPES: QuestionType[];
export const QUESTION_TYPE_LABELS: Record<QuestionType, string>;
export const RATING_MIN: number;
export const RATING_MAX: number;
export const LIMITS: {
  maxQuestions: number;
  maxOptions: number;
  minOptions: number;
  maxLabel: number;
  maxDescription: number;
  maxOptionLabel: number;
  defaultTextMaxLength: number;
  hardTextMaxLength: number;
  maxTitle: number;
  maxSurveyDescription: number;
};
export const OPERATORS_BY_TYPE: Record<QuestionType, Operator[]>;
export const OPERATOR_LABELS: Record<Operator, string>;
export const VALUELESS_OPERATORS: Set<Operator>;

export function makeId(prefix?: string): string;
export function createQuestion(type?: QuestionType): Question;
export function isAnswered(value: unknown): boolean;
export function evaluateCondition(condition: Condition, answer: unknown): boolean;
export function getVisibleQuestionIds(schema: SurveySchema | null | undefined, answers?: Answers): Set<string>;
export function getVisibleQuestions(schema: SurveySchema | null | undefined, answers?: Answers): Question[];
export function validateSurveySchema(schema: unknown): { valid: boolean; errors: SchemaError[] };
export function validateAnswers(
  schema: SurveySchema,
  rawAnswers: unknown,
  options?: { partial?: boolean },
): { valid: boolean; errors: Record<string, string>; answers: Answers };
export function describeCondition(condition: Condition | null | undefined, questions: Question[]): string;
