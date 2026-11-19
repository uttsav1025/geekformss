import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { type Answers, validateAnswers } from '@survey/shared';
import { ApiError, api, errorMessage } from '../lib/api';
import type { DraftSaved, PublicForm, PublicFormResponse } from '../types/api';
import type { OnAnswer } from '../types/ui';
import SurveyForm from '../components/form/SurveyForm';
import NotFound from './NotFound';
import Logo from '../components/common/Logo';
import InkTick from '../components/common/InkTick';
import ThemeToggle from '../components/common/ThemeToggle';

type FormState =
  | { status: 'loading' }
  | { status: 'missing'; message: string }
  | { status: 'closed'; message: string }
  | { status: 'ready' | 'done'; survey: PublicForm };

type DraftSaveState = null | 'saving' | 'saved' | 'error';

const resumeKey = (slug: string) => `geekforms.resume.${slug}`;
const readToken = (slug: string): string | null => {
  try {
    return localStorage.getItem(resumeKey(slug));
  } catch {
    return null;
  }
};
const writeToken = (slug: string, t: string | null) => {
  try {
    if (t) localStorage.setItem(resumeKey(slug), t);
    else localStorage.removeItem(resumeKey(slug));
  } catch {
    /* ignore */
  }
};

const AUTOSAVE_MS = 1200;

export default function PublicSurvey() {
  const { slug = '' } = useParams();
  const [state, setState] = useState<FormState>({ status: 'loading' });
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<DraftSaveState>(null);
  const [resumed, setResumed] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const tokenRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const token = readToken(slug);
    api
      .get<PublicFormResponse>(`/public/surveys/${slug}`, { anonymous: true, params: token ? { resume: token } : undefined })
      .then((d) => {
        if (d.resume) {
          tokenRef.current = d.resume.token;
          setAnswers(d.resume.answers);
          setResumed(true);
        } else if (token) {
          writeToken(slug, null);
        }
        document.title = d.survey.title;
        setState({ status: 'ready', survey: d.survey });
      })
      .catch((e: unknown) =>
        setState(
          e instanceof ApiError && e.status === 410
            ? { status: 'closed', message: errorMessage(e) }
            : { status: 'missing', message: errorMessage(e) },
        ),
      );
  }, [slug]);

  const saveDraft = useCallback(
    async (current: Answers) => {
      setSaveState('saving');
      try {
        const d = await api.put<DraftSaved>(
          `/public/surveys/${slug}/draft`,
          { answers: current, resumeToken: tokenRef.current, website: honeypot || undefined },
          { anonymous: true },
        );
        if (d.resumeToken && d.resumeToken !== tokenRef.current) {
          tokenRef.current = d.resumeToken;
          writeToken(slug, d.resumeToken);
        }
        setSaveState(d.savedAt ? 'saved' : null);
      } catch {
        setSaveState('error');
      }
    },
    [slug, honeypot],
  );

  // Debounced autosave of partial responses.
  useEffect(() => {
    if (!dirtyRef.current || state.status !== 'ready') return undefined;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void saveDraft(answers), AUTOSAVE_MS);
    return () => clearTimeout(timerRef.current);
  }, [answers, saveDraft, state.status]);

  const onAnswer: OnAnswer = (qid, value) => {
    dirtyRef.current = true;
    setAnswers((a) => {
      const next = { ...a };
      if (value === undefined) delete next[qid];
      else next[qid] = value;
      return next;
    });
    if (errors[qid]) setErrors(({ [qid]: _drop, ...rest }) => rest);
  };

  const focusFirstError = (errs: Record<string, string>) => {
    if (state.status !== 'ready') return;
    const first = state.survey.schema.questions.find((q) => errs[q.id]);
    if (first)
      document.getElementById(`f_${first.id}`)?.closest('.card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submit = async () => {
    if (state.status !== 'ready') return;
    setFormError('');
    const result = validateAnswers(state.survey.schema, answers);
    if (!result.valid) {
      setErrors(result.errors);
      setFormError(
        `${Object.keys(result.errors).length === 1 ? 'One question needs' : `${Object.keys(result.errors).length} questions need`} an answer`,
      );
      focusFirstError(result.errors);
      return;
    }
    clearTimeout(timerRef.current);
    setSubmitting(true);
    try {
      await api.post(
        `/public/surveys/${slug}/responses`,
        { answers: result.answers, resumeToken: tokenRef.current, website: honeypot || undefined },
        { anonymous: true },
      );
      writeToken(slug, null);
      setState({ status: 'done', survey: state.survey });
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ApiError && e.errors.length) {
        setErrors(e.details);
        focusFirstError(e.details);
      }
      setFormError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    writeToken(slug, null);
    tokenRef.current = null;
    dirtyRef.current = false;
    setAnswers({});
    setErrors({});
    setResumed(false);
    setSaveState(null);
  };

  if (state.status === 'loading')
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <div className="spinner" />
      </div>
    );
  if (state.status === 'missing')
    return <NotFound title="Survey not found" message="This link may be wrong, or the survey isn't published yet." />;
  if (state.status === 'closed') return <NotFound title="Survey closed" message={state.message} />;

  return (
    <div className="public min-h-screen bg-bg px-4 pt-16 pb-12 text-fg max-sm:pt-8">
      <div className="mx-auto max-w-160">
        {state.status === 'done' ? (
          <div className="card flex animate-fade-in flex-col items-center px-8 py-16 text-center [&_h1]:mb-2 [&_p]:m-0 [&_p]:max-w-md">
            <InkTick size={56} draw strokeWidth={2.2} className="mb-5" />
            <h1>Thank you</h1>
            <p className="text-fg-2">Your answers to {state.survey.title} are in. You can close this page.</p>
          </div>
        ) : (
          <>
            {resumed && (
              <div className="alert">
                Your saved answers are back where you left them.{' '}
                <button type="button" className="link-btn" onClick={startOver}>
                  Start over
                </button>
              </div>
            )}
            <SurveyForm
              title={state.survey.title}
              description={state.survey.description}
              schema={state.survey.schema}
              answers={answers}
              onAnswer={onAnswer}
              errors={errors}
              onSubmit={() => void submit()}
              submitting={submitting}
              honeypot={honeypot}
              onHoneypot={setHoneypot}
              footer={
                <div className="flex flex-col gap-1 [&_.field-error]:m-0">
                  {formError && (
                    <span className="field-error" role="alert">
                      {formError}
                    </span>
                  )}
                  <span className="note" aria-live="polite">
                    {saveState === 'saving' && 'Saving…'}
                    {saveState === 'saved' && 'Progress saved. Come back on this device to finish'}
                    {saveState === 'error' && "Couldn't save. Your answers are still here"}
                  </span>
                </div>
              }
            />
          </>
        )}
        <div className="mt-8 flex items-center justify-center gap-4">
          <p className="m-0 flex items-center justify-center gap-2 text-[13px] text-muted">
            <Logo size={14} /> Made with GeekForms
          </p>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
