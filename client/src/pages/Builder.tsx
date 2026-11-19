import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { type Question, type SchemaError, validateSurveySchema } from '@survey/shared';
import PageBar from '../components/common/PageBar';
import SegmentedTabs from '../components/common/SegmentedTabs';
import SaveStatus from '../components/common/SaveStatus';
import Toast from '../components/common/Toast';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import SurveyDetailsCard from '../components/builder/SurveyDetailsCard';
import QuestionList from '../components/builder/QuestionList';
import BuilderPreview from '../components/builder/BuilderPreview';
import BuilderSidebar from '../components/builder/BuilderSidebar';
import { useSurveyDraft } from '../hooks/useSurveyDraft';

const TABS = [
  { value: 'build', label: 'Build' },
  { value: 'preview', label: 'Preview' },
];

/** Survey builder: edit the draft (autosaved), preview it, publish it. */
export default function Builder() {
  const { id = '' } = useParams();
  const { survey, versions, draft, loadError, saveState, notice, publishing, update, publish, setStatus, flash } =
    useSurveyDraft(id);
  const [tab, setTab] = useState('build');

  const validation = useMemo(() => (draft ? validateSurveySchema(draft.schema) : { valid: true, errors: [] }), [draft]);
  const errorsByQuestion = useMemo(() => {
    const m: Record<string, SchemaError[]> = {};
    for (const e of validation.errors) if (e.questionId) (m[e.questionId] ??= []).push(e);
    return m;
  }, [validation]);

  if (loadError) return <Alert tone="error">{loadError}</Alert>;
  if (!draft || !survey) return <Spinner />;

  const questions = draft.schema.questions;
  const setQuestions = (fn: (qs: Question[]) => Question[]) =>
    update((d) => ({ ...d, schema: { ...d.schema, questions: fn(d.schema.questions) } }));

  return (
    <div>
      <PageBar crumbs={[{ label: 'All surveys', to: '/admin/surveys' }, { label: draft.title.trim() || 'Untitled survey' }]}>
        <SaveStatus state={saveState} className="max-sm:hidden" />
        <Link to={`/admin/surveys/${id}/analytics`} className="link-btn text-[13px] max-sm:hidden">
          Results
        </Link>
        <SegmentedTabs value={tab} onChange={setTab} options={TABS} label="Builder view" />
      </PageBar>

      <Toast notice={notice} />

      <div className="grid grid-cols-[minmax(0,1fr)_296px] items-start gap-6 max-md:grid-cols-1">
        <section className="flex min-w-0 flex-col gap-3">
          {/* The editor stays mounted while previewing, so collapse state and scroll survive. */}
          <div className="flex min-w-0 flex-col gap-3" hidden={tab !== 'build'}>
            <SurveyDetailsCard
              title={draft.title}
              description={draft.description}
              onChange={(patch) => update((d) => ({ ...d, ...patch }))}
            />
            <QuestionList
              questions={questions}
              setQuestions={setQuestions}
              errorsByQuestion={errorsByQuestion}
              isPublished={Boolean(survey.currentVersion)}
              flash={flash}
            />
          </div>
          {tab === 'preview' && <BuilderPreview title={draft.title} description={draft.description} schema={draft.schema} />}
        </section>

        <BuilderSidebar
          survey={survey}
          versions={versions}
          validation={validation}
          questionCount={questions.length}
          saveState={saveState}
          publishing={publishing}
          onPublish={() => void publish()}
          onClose={() => void setStatus('closed')}
        />
      </div>
    </div>
  );
}
