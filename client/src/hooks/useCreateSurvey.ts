import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../lib/api';
import type { Survey } from '../types/api';

/** Create an untitled survey and open it in the builder. */
export function useCreateSurvey() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const create = useCallback(async () => {
    setCreating(true);
    setError('');
    try {
      const survey = await api.post<Survey>('/surveys', { title: 'Untitled survey' });
      navigate(`/admin/surveys/${survey.id}/edit`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }, [navigate]);

  return { create, creating, error };
}
