import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useSurveys } from '../hooks/useSurveys';
import { useCreateSurvey } from '../hooks/useCreateSurvey';
import LineChart, { fillDays } from '../components/common/LineChart';
import SurveyTable from '../components/surveys/SurveyTable';
import StatStrip, { type Stat } from '../components/common/StatStrip';

const nf = new Intl.NumberFormat();

function changeLabel(current: number, previous: number): string {
  if (!previous) return current ? 'None in the 30 days before' : 'None in the last 60 days';
  const diff = current - previous;
  if (diff === 0) return 'Same as the 30 days before';
  const pct = Math.round((diff / previous) * 100);
  return `${diff > 0 ? '+' : ''}${pct}% vs the 30 days before`;
}

/**
 * Home: account-level numbers (never repeating the list's own counts), the
 * live surveys, then the 30-day trend as the page's one large visual.
 */
export default function Dashboard() {
  const { data, error, remove } = useSurveys();
  const { create, creating, error: createError } = useCreateSurvey();

  const days = useMemo(() => (data ? fillDays(data.activity.days, 30) : []), [data]);
  const surveys = data?.surveys;
  const last30 = days.reduce((n, d) => n + d.count, 0);
  const complete = surveys?.reduce((n, s) => n + s.responseCount, 0) ?? 0;
  const inProgress = surveys?.reduce((n, s) => n + s.partialCount, 0) ?? 0;
  const rate = complete + inProgress ? Math.round((complete / (complete + inProgress)) * 100) : null;
  const notLive = surveys ? surveys.filter((s) => s.status !== 'published').length : 0;

  const stats: Stat[] = !data
    ? []
    : [
        {
          label: 'Responses, last 30 days',
          value: nf.format(last30),
          note: changeLabel(last30, data.activity.previousTotal),
          lead: true,
        },
        { label: 'Responses, all time', value: nf.format(complete) },
        { label: 'Completion rate', value: rate == null ? '—' : `${rate}%`, note: 'Submitted of started' },
        { label: 'In progress', value: nf.format(inProgress), note: 'Started in the last 30 days' },
      ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">Home</h1>

      {(error || createError) && <div className="alert alert-error">{error || createError}</div>}
      {!data && !error && <div className="spinner" />}

      {surveys?.length === 0 && (
        <div className="card px-6 py-12 text-center [&_h2]:mb-2">
          <h2>No surveys yet</h2>
          <p className="text-fg-2">Write a few questions, add a condition or two, and share one link. Answers show up here.</p>
          <button className="btn btn-primary" onClick={() => void create()} disabled={creating}>
            <Plus size={16} strokeWidth={1.5} aria-hidden="true" /> New survey
          </button>
        </div>
      )}

      {surveys && surveys.length > 0 && (
        <>
          <StatStrip items={stats} />

          <SurveyTable
            title="Live surveys"
            featured
            onlyStatus="published"
            onDelete={remove}
            footer={
              notLive > 0 && (
                <Link to="/admin/surveys" className="link-btn text-[13px]">
                  {notLive} more in drafts or closed. See all surveys{' '}
                  <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
                </Link>
              )
            }
          />

          <section className="card px-6 pt-6 pb-4" aria-labelledby="activity-title">
            <h2 id="activity-title" className="mb-4 text-[13px]/5 font-medium text-fg-2">
              Responses per day, last 30 days
            </h2>
            <LineChart data={days} height={280} label="Completed responses per day across all surveys, last 30 days" />
          </section>
        </>
      )}
    </div>
  );
}
