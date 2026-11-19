import type { SurveySchema } from '@survey/shared';

/** One answer as the form holds it: text/single → string, multi → string[], rating → number. */
export type AnswerValue = string | number | string[];
export type OnAnswer = (questionId: string, value: AnswerValue | undefined) => void;

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export type NoticeKind = 'info' | 'success' | 'error';
export interface Notice {
  kind: NoticeKind;
  text: string;
}
export type Flash = (kind: NoticeKind, text: string) => void;

/** The editable part of a survey in the builder. */
export interface Draft {
  title: string;
  description: string;
  schema: SurveySchema;
}
