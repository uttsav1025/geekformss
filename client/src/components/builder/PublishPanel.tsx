import InkTick from '../common/InkTick';
import StatusBadge from '../common/StatusBadge';
import { fmtRelative } from '../../lib/format';
import { plural } from '../../lib/questionOps';
import type { SchemaError } from '@survey/shared';
import type { Survey } from '../../types/api';
import type { SaveState } from '../../types/ui';

export interface PublishPanelProps {
  survey: Survey;
  validation: { valid: boolean; errors: SchemaError[] };
  questionCount: number;
  saveState: SaveState;
  publishing: boolean;
  onPublish: () => void;
  onClose: () => void;
}

/**
 * Status, validation summary and the one primary action for the survey's
 * lifecycle. When there is nothing to publish it says so in words instead of
 * showing a dead button.
 */
export default function PublishPanel({
  survey,
  validation,
  questionCount,
  saveState,
  publishing,
  onPublish,
  onClose,
}: PublishPanelProps) {
  const current = survey.currentVersion;
  const isPublished = Boolean(current);
  const canPublish =
    validation.valid &&
    questionCount > 0 &&
    (!isPublished || survey.hasUnpublishedChanges || saveState !== 'saved' || survey.status !== 'published');
  // Live, saved and identical to the published version: nothing left to do.
  const upToDate = isPublished && survey.status === 'published' && !survey.hasUnpublishedChanges && saveState === 'saved';
  const reopen = survey.status === 'closed' && !survey.hasUnpublishedChanges && saveState === 'saved';

  return (
    <div className="card flex flex-col gap-3 p-4 [&_p]:m-0">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={survey.status} />
        {current && (
          <span className="text-[13px] text-muted">
            v{current.version} · {fmtRelative(current.publishedAt)}
          </span>
        )}
      </div>

      {!validation.valid && (
        <p className="field-error mt-0">
          {validation.errors.length} {plural(validation.errors.length, 'issue')} to fix before publishing
        </p>
      )}
      {current && survey.hasUnpublishedChanges && validation.valid && (
        <p className="note">
          Respondents can&apos;t see your edits yet. Publishing creates version {current.version + 1}; existing responses stay
          with their version.
        </p>
      )}

      {upToDate ? (
        <p className="flex items-center gap-2 rounded-md bg-raised px-3 py-2 text-sm text-fg-2">
          <InkTick size={16} strokeWidth={2.6} /> Respondents see the latest version
        </p>
      ) : (
        <button className="btn btn-primary w-full" onClick={onPublish} disabled={!canPublish || publishing}>
          {publishing ? 'Publishing…' : !isPublished ? 'Publish survey' : reopen ? 'Reopen survey' : 'Publish changes'}
        </button>
      )}
      {isPublished && survey.status === 'published' && (
        <button className="btn w-full" onClick={onClose}>
          Close survey
        </button>
      )}
    </div>
  );
}
