import Select from '../common/Select';
import type { SurveyVersion } from '../../types/api';

interface VersionSelectProps {
  versions: SurveyVersion[];
  /** '' = current version, 'all', or a version number as text. */
  value: string;
  onChange: (value: string) => void;
}

/** Pick which published version's responses to show. The current version is the empty value. */
export default function VersionSelect({ versions, value, onChange }: VersionSelectProps) {
  const current = versions[0];
  if (!current) return null;
  const total = versions.reduce((n, v) => n + v.responseCount, 0);
  return (
    <div className="field mb-0">
      <span id="version-label">Version</span>
      <Select
        className="min-w-50 max-sm:min-w-0"
        compact
        aria-labelledby="version-label"
        value={value}
        onChange={onChange}
        options={[
          { value: '', label: `v${current.version} (current)`, hint: `${current.responseCount} responses` },
          ...versions
            .slice(1)
            .map((v) => ({ value: String(v.version), label: `v${v.version}`, hint: `${v.responseCount} responses` })),
          { value: 'all', label: 'All versions', hint: `${total} responses` },
        ]}
      />
    </div>
  );
}
