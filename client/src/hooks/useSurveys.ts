import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useDeleteSurvey } from './useDeleteSurvey';
import type { OwnerStats, Survey } from '../types/api';

export interface SurveysData {
  surveys: Survey[];
  activity: OwnerStats;
}

/**
 * Account-level data for Home: the surveys (for the stat strip) plus daily
 * activity. The table itself searches the server; see useSurveySearch.
 */
export function useSurveys() {
  const [data, setData] = useState<SurveysData | null>(null);
  const [error, setError] = useState('');
  const { remove: confirmDelete, error: deleteError } = useDeleteSurvey();

  useEffect(() => {
    // limit=100 is the server cap; enough for the account-level totals.
    Promise.all([
      api.get<Survey[]>('/surveys', { params: { limit: 100, sort: 'updated' } }),
      api.get<OwnerStats>('/surveys/stats'),
    ])
      .then(([surveys, activity]) => setData({ surveys, activity }))
      .catch((e: unknown) => setError(errorMessage(e)));
  }, []);

  const remove = useCallback(
    async (s: Survey) => {
      const deleted = await confirmDelete(s);
      if (deleted) setData((d) => d && { ...d, surveys: d.surveys.filter((x) => x.id !== s.id) });
      return deleted;
    },
    [confirmDelete],
  );

  return { data, error: error || deleteError, remove };
}
