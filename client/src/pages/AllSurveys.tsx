import { useDeleteSurvey } from '../hooks/useDeleteSurvey';
import SurveyTable from '../components/surveys/SurveyTable';
import { useCreateSurvey } from '../hooks/useCreateSurvey';

/** Every survey, any status: search and filter pills above the table. */
export default function AllSurveys() {
  const { remove, error } = useDeleteSurvey();
  const { create, creating } = useCreateSurvey();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">All surveys</h1>
      {error && <div className="alert alert-error">{error}</div>}
      {
        <SurveyTable
          title="All surveys"
          layout="split"
          onDelete={remove}
          footer={
            <p className="note flex flex-wrap items-center gap-1">
              Drafts stay private until you publish them. Publishing gives a survey its public link.{' '}
              <button type="button" className="link-btn text-[13px]" onClick={() => void create()} disabled={creating}>
                Start a new survey
              </button>
            </p>
          }
        />
      }
    </div>
  );
}
