import { useParams, useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { download, errorMessage } from '../lib/api';
import PageBar from '../components/common/PageBar';
import Masonry from '../components/common/Masonry';
import StatusBadge from '../components/common/StatusBadge';
import LineChart, { fillDays } from '../components/common/LineChart';
import Spinner from '../components/common/Spinner';
import Alert from '../components/common/Alert';
import EmptyState from '../components/common/EmptyState';
import SummaryStats from '../components/analytics/SummaryStats';
import VersionSelect from '../components/analytics/VersionSelect';
import QuestionResult from '../components/analytics/QuestionResult';
import { useSurveyAnalytics } from '../hooks/useSurveyAnalytics';
import { useTooltip } from '../hooks/useTooltip';

/** Results for one survey: totals, daily trend, and a card per question. */
export default function Analytics() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const version = params.get('version') ?? '';
  const { data, versions, error, setError, loading } = useSurveyAnalytics(id, version);
  const tooltip = useTooltip();

  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return <Spinner />;

  const { totals, questions, timeline } = data;
  const exportCsv = () =>
    download(`/surveys/${id}/responses.csv${version ? `?version=${version}` : ''}`, `${data.survey.slug}-responses.csv`).catch(
      (e: unknown) => setError(errorMessage(e)),
    );

  return (
    <div className={`transition-opacity duration-200 ease-gf [&>.card]:mb-4 [&>dl]:mb-4 ${loading ? 'opacity-60' : ''}`}>
      <PageBar
        crumbs={[
          { label: 'All surveys', to: '/admin/surveys' },
          { label: data.survey.title, to: `/admin/surveys/${id}/edit` },
          { label: 'Results' },
        ]}
      />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{data.survey.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <StatusBadge status={data.survey.status} />
            {data.version !== null && (
              <span className="note">{data.version === 'all' ? 'All versions' : `Version ${data.version}`}</span>
            )}
          </div>
        </div>
        {/* Filters: one row, above the charts */}
        <div className="flex flex-wrap items-end gap-3">
          {versions.length > 1 && (
            <VersionSelect versions={versions} value={version} onChange={(v) => setParams(v ? { version: String(v) } : {})} />
          )}
          <button className="btn" onClick={exportCsv} disabled={!totals.responses}>
            <Download size={16} strokeWidth={1.5} aria-hidden="true" /> Export CSV
          </button>
        </div>
      </div>

      {data.version === null ? (
        <EmptyState title="Not published yet">Publish the survey to start collecting responses</EmptyState>
      ) : (
        <>
          <SummaryStats totals={totals} />

          {timeline.length > 0 && (
            <div className="card p-6">
              <h2 className="mb-4 text-[13px]/5 font-medium text-fg-2">Responses per day, last 30 days</h2>
              <LineChart data={fillDays(timeline, 30)} height={200} />
            </div>
          )}

          {data.version === 'all' && (
            <p className="mb-4 text-[13px] text-muted">
              Showing all versions, labelled with the latest questions. Options removed in later versions appear as “(removed
              option)”.
            </p>
          )}

          {totals.responses === 0 ? (
            <EmptyState title="No responses yet">Share the public link. Results appear here as people submit</EmptyState>
          ) : (
            <Masonry>
              {questions.map((q) => (
                <QuestionResult key={q.id} q={q} surveyId={id} version={version} tooltip={tooltip} />
              ))}
            </Masonry>
          )}
        </>
      )}
      {tooltip.node}
    </div>
  );
}
