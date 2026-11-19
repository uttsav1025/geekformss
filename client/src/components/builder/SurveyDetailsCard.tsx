// Inputs brighten their border on hover so they read as editable.
const HOVER =
  '[&_input:not(:focus)]:hover:border-[color-mix(in_srgb,var(--text)_28%,transparent)] [&_textarea:not(:focus)]:hover:border-[color-mix(in_srgb,var(--text)_28%,transparent)]';

/** Survey title and description, shown to respondents at the top of the form. */
interface SurveyDetailsCardProps {
  title: string;
  description: string;
  onChange: (patch: { title?: string; description?: string }) => void;
}

export default function SurveyDetailsCard({ title, description, onChange }: SurveyDetailsCardProps) {
  return (
    <div className={`card px-6 pt-5 pb-1 ${HOVER}`}>
      <label className="field">
        <span>Survey title</span>
        <input
          className="min-h-12 px-3 py-2 text-xl font-medium"
          value={title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Product feedback, event RSVP…"
          maxLength={200}
        />
      </label>
      <label className="field">
        <span>
          Description <span className="font-normal text-muted">(optional, shown to respondents above the first question)</span>
        </span>
        <textarea
          className="min-h-20"
          value={description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What the survey is for and how long it takes"
          rows={3}
          maxLength={2000}
        />
      </label>
    </div>
  );
}
