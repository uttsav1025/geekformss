import { useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { Analytics, SurveyVersion } from '../types/api';

/** Analytics for one survey version ('' = current, 'all', or a number), plus its version list. */
export function useSurveyAnalytics(id: string, version: string) {
  const [data, setData] = useState<Analytics | null>(null);
  const [versions, setVersions] = useState<SurveyVersion[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<SurveyVersion[]>(`/surveys/${id}/versions`)
      .then(setVersions)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    setLoading(true);
    api
      .get<Analytics>(`/surveys/${id}/analytics`, { params: version ? { version } : undefined })
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [id, version]);

  return { data, versions, error, setError, loading };
}
