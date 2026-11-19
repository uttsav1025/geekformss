import { useCallback, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useConfirm } from '../components/common/ConfirmDialog';
import type { Survey } from '../types/api';

/** Confirm, then delete a survey. Resolves true when it was deleted. */
export function useDeleteSurvey() {
  const confirm = useConfirm();
  const [error, setError] = useState('');

  const remove = useCallback(
    async (s: Survey): Promise<boolean> => {
      const ok = await confirm({
        title: `Delete “${s.title}”?`,
        message: s.responseCount
          ? `The survey and its public link are removed. Its ${s.responseCount} ${s.responseCount === 1 ? 'response is' : 'responses are'} kept on the server but will no longer appear anywhere.`
          : 'The survey and its public link are removed.',
        confirmLabel: 'Delete survey',
      });
      if (!ok) return false;
      try {
        setError('');
        await api.delete(`/surveys/${s.id}`);
        return true;
      } catch (e) {
        setError(errorMessage(e));
        return false;
      }
    },
    [confirm],
  );

  return { remove, error };
}
