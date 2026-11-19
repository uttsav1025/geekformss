import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import type { Survey, SurveyStatus, SurveyVersion } from '../types/api';
import type { Draft, Flash, Notice, NoticeKind, SaveState } from '../types/ui';

const AUTOSAVE_MS = 800;
const NOTICE_MS = 4000;

/**
 * Everything the builder needs about one survey: load, edit the draft with
 * debounced autosave, publish, open/close, and transient notices.
 *
 * Saves are serialised (one request in flight; edits made meanwhile trigger
 * exactly one follow-up save), so responses can never arrive out of order.
 */
export function useSurveyDraft(id: string) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [versions, setVersions] = useState<SurveyVersion[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [publishing, setPublishing] = useState(false);

  const draftRef = useRef<Draft | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savingRef = useRef<Promise<void> | null>(null); // in-flight save promise
  const pendingRef = useRef(false);

  const flash: Flash = useCallback((kind: NoticeKind, text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), NOTICE_MS);
  }, []);

  useEffect(() => {
    Promise.all([api.get<Survey>(`/surveys/${id}`), api.get<SurveyVersion[]>(`/surveys/${id}/versions`)])
      .then(([loaded, history]) => {
        setSurvey(loaded);
        setVersions(history);
        const initial = { title: loaded.title, description: loaded.description, schema: loaded.schema };
        draftRef.current = initial;
        setDraft(initial);
      })
      .catch((e: unknown) => setLoadError(errorMessage(e)));
  }, [id]);

  /** Persist the latest draft. */
  const save = useCallback((): Promise<void> => {
    clearTimeout(timerRef.current);
    timerRef.current = undefined;
    if (savingRef.current) {
      pendingRef.current = true;
      return savingRef.current;
    }
    const body = draftRef.current;
    if (!body) return Promise.resolve();
    const run = (): Promise<void> => {
      setSaveState('saving');
      return api
        .patch<Survey>(`/surveys/${id}`, {
          title: body.title.trim() || 'Untitled survey',
          description: body.description,
          schema: body.schema,
        })
        .then((saved) => {
          setSurvey(saved);
          setSaveState(pendingRef.current ? 'dirty' : 'saved');
        })
        .catch((e: unknown) => {
          setSaveState('error');
          flash('error', `Save failed: ${errorMessage(e)}`);
        });
    };
    // Edits made while a save is in flight get exactly one follow-up save.
    const chain = async () => {
      await run();
      while (pendingRef.current) {
        pendingRef.current = false;
        const latest = draftRef.current;
        if (latest) Object.assign(body, latest);
        await run();
      }
      savingRef.current = null;
    };
    savingRef.current = chain();
    return savingRef.current;
  }, [id, flash]);

  /** Apply an edit to the draft and schedule an autosave. */
  const update = useCallback(
    (fn: (d: Draft) => Draft) => {
      setDraft((d) => {
        if (!d) return d;
        const next = fn(d);
        draftRef.current = next;
        return next;
      });
      setSaveState('dirty');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void save(), AUTOSAVE_MS);
    },
    [save],
  );

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  // Flush a pending autosave when navigating away inside the app.
  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (draftRef.current) void save();
      }
    },
    [save],
  );

  const publish = useCallback(async () => {
    setPublishing(true);
    try {
      await save();
      while (savingRef.current) await savingRef.current;
      const published = await api.post<Survey>(`/surveys/${id}/publish`);
      setSurvey(published);
      setVersions(await api.get<SurveyVersion[]>(`/surveys/${id}/versions`));
      flash('success', `Version ${published.currentVersion?.version ?? ''} is live`);
    } catch (e) {
      flash('error', errorMessage(e));
    } finally {
      setPublishing(false);
    }
  }, [id, save, flash]);

  const setStatus = useCallback(
    async (status: Exclude<SurveyStatus, 'draft'>) => {
      try {
        setSurvey(await api.patch<Survey>(`/surveys/${id}/status`, { status }));
        flash('success', status === 'closed' ? 'Survey closed. New responses are turned off' : 'Survey reopened');
      } catch (e) {
        flash('error', errorMessage(e));
      }
    },
    [id, flash],
  );

  return { survey, versions, draft, loadError, saveState, notice, publishing, update, publish, setStatus, flash };
}
