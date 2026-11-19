import { useState } from 'react';
import type { Answers, SurveySchema } from '@survey/shared';
import type { OnAnswer } from '../../types/ui';
import SurveyForm from '../form/SurveyForm';

/** The live form, answerable but never submitted, for testing conditional logic. */
export default function BuilderPreview({
  title,
  description,
  schema,
}: {
  title: string;
  description: string;
  schema: SurveySchema;
}) {
  const [answers, setAnswers] = useState<Answers>({});
  const onAnswer: OnAnswer = (qid, v) =>
    setAnswers((a) => {
      const n = { ...a };
      if (v === undefined) delete n[qid];
      else n[qid] = v;
      return n;
    });
  return (
    <div className="rounded-lg bg-bg">
      <div className="mb-4 rounded-md bg-warn-soft px-4 py-2 text-sm font-medium text-warn">
        Preview. Answer as a respondent would to check your conditions. Nothing is saved
      </div>
      <SurveyForm title={title} description={description} schema={schema} answers={answers} onAnswer={onAnswer} preview />
    </div>
  );
}
