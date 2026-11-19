import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import CopyButton from '../common/CopyButton';
import { fmtDate, publicUrl } from '../../lib/format';
import PublishPanel, { type PublishPanelProps } from './PublishPanel';
import type { Survey, SurveyVersion } from '../../types/api';

const SIDE_CARD = 'card flex flex-col gap-3 p-4 [&_p]:m-0';

function ShareLinkCard({ survey }: { survey: Survey }) {
  const url = publicUrl(survey.slug);
  return (
    <div className={SIDE_CARD}>
      <span className="field-label">Public link</span>
      <div className="flex flex-col gap-2">
        <code className="block p-2 break-all">{url}</code>
        <div className="flex gap-2">
          <CopyButton text={url} />
          <a className="btn btn-sm" href={`/s/${survey.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" /> Open
          </a>
        </div>
      </div>
      {survey.status === 'closed' && <p className="note">Closed. The link now tells visitors the survey is closed</p>}
    </div>
  );
}

function ResponsesCard({ survey }: { survey: Survey }) {
  return (
    <div className={SIDE_CARD}>
      <span className="field-label">Responses</span>
      <div className="text-[32px]/none font-medium tabular-nums">{survey.responseCount}</div>
      {survey.partialCount > 0 && <p className="note">{survey.partialCount} in progress</p>}
    </div>
  );
}

function VersionHistory({ surveyId, versions }: { surveyId: string; versions: SurveyVersion[] }) {
  return (
    <div className={SIDE_CARD}>
      <span className="field-label">Version history</span>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
        {versions.map((v) => (
          <li key={v.version} className="flex items-baseline gap-2">
            <strong>v{v.version}</strong>
            <span className="flex-1 font-mono text-xs text-muted">
              {fmtDate(v.publishedAt)} · {v.questionCount} Q
            </span>
            <Link to={`/admin/surveys/${surveyId}/analytics?version=${v.version}`} className="text-[13px]">
              {v.responseCount} resp.
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Right-hand column of the builder: lifecycle, sharing, responses, history. */
export default function BuilderSidebar({
  survey,
  versions,
  validation,
  questionCount,
  saveState,
  publishing,
  onPublish,
  onClose,
}: PublishPanelProps & { versions: SurveyVersion[] }) {
  return (
    <aside className="sticky top-31 flex flex-col gap-3 max-md:static max-md:-order-1">
      <PublishPanel
        survey={survey}
        validation={validation}
        questionCount={questionCount}
        saveState={saveState}
        publishing={publishing}
        onPublish={onPublish}
        onClose={onClose}
      />
      {survey.currentVersion && <ShareLinkCard survey={survey} />}
      <ResponsesCard survey={survey} />
      {versions.length > 0 && <VersionHistory surveyId={survey.id} versions={versions} />}
    </aside>
  );
}
