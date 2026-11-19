/**
 * Shared survey domain logic.
 *
 * Used by BOTH the React client (live validation in the builder, rendering and
 * validating the public form) and the Express server (authoritative validation
 * before anything is written to Postgres). Keeping it in one place guarantees
 * the two sides can never disagree about what a valid survey or answer is.
 *
 * Survey schema shape (stored as JSONB):
 * {
 *   questions: [
 *     {
 *       id: "q_ab12cd",             // stable across versions, used as answer key
 *       type: "text" | "single" | "multi" | "rating",
 *       label: "How did you hear about us?",
 *       description?: "Optional helper text",
 *       required: boolean,
 *       options?: [{ id: "o_x1", label: "Friend" }],   // single / multi only
 *       multiline?: boolean,                            // text only
 *       maxLength?: number,                             // text only
 *       condition?: {                                   // show only if...
 *         questionId: "q_earlier",
 *         operator: "equals" | "not_equals" | "includes" | "not_includes"
 *                 | "gte" | "lte" | "answered" | "not_answered",
 *         value?: string | number
 *       } | null
 *     }
 *   ]
 * }
 *
 * Answer shapes (stored as JSONB object keyed by question id):
 *   text   -> string
 *   single -> option id (string)
 *   multi  -> array of option ids
 *   rating -> integer 1..5
 */

export const QUESTION_TYPES = ['text', 'single', 'multi', 'rating'];

export const QUESTION_TYPE_LABELS = {
  text: 'Text input',
  single: 'Multiple choice',
  multi: 'Checkboxes',
  rating: 'Rating (1–5)',
};

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const LIMITS = {
  maxQuestions: 100,
  maxOptions: 50,
  minOptions: 2,
  maxLabel: 500,
  maxDescription: 1000,
  maxOptionLabel: 200,
  defaultTextMaxLength: 2000,
  hardTextMaxLength: 10000,
  maxTitle: 200,
  maxSurveyDescription: 2000,
};

/** Which operators make sense for a condition on a question of a given type. */
export const OPERATORS_BY_TYPE = {
  text: ['answered', 'not_answered', 'equals', 'not_equals'],
  single: ['equals', 'not_equals', 'answered', 'not_answered'],
  multi: ['includes', 'not_includes', 'answered', 'not_answered'],
  rating: ['equals', 'not_equals', 'gte', 'lte', 'answered', 'not_answered'],
};

export const OPERATOR_LABELS = {
  equals: 'is',
  not_equals: 'is not',
  includes: 'includes',
  not_includes: 'does not include',
  gte: 'is at least',
  lte: 'is at most',
  answered: 'is answered',
  not_answered: 'is not answered',
};

export const VALUELESS_OPERATORS = new Set(['answered', 'not_answered']);

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/** Generate a short random id with a prefix, e.g. q_k3j9x2. */
export function makeId(prefix = 'q') {
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `${prefix}_${rand}`;
}

/** Create a blank question of the given type. */
export function createQuestion(type = 'text') {
  const q = { id: makeId('q'), type, label: '', required: false, condition: null };
  if (type === 'single' || type === 'multi') {
    q.options = [
      { id: makeId('o'), label: 'Option 1' },
      { id: makeId('o'), label: 'Option 2' },
    ];
  }
  if (type === 'text') q.multiline = false;
  return q;
}

/** True if a stored answer value counts as "answered". */
export function isAnswered(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Evaluate a single condition against the answer to the question it depends on.
 */
export function evaluateCondition(condition, answer) {
  const { operator, value } = condition;
  const answered = isAnswered(answer);
  switch (operator) {
    case 'answered':
      return answered;
    case 'not_answered':
      return !answered;
    case 'equals':
      if (!answered) return false;
      if (typeof answer === 'string') return answer.trim().toLowerCase() === String(value).trim().toLowerCase();
      return Number(answer) === Number(value);
    case 'not_equals':
      // An unanswered question "is not X" — this lets admins branch on "anything but Yes".
      if (!answered) return true;
      if (typeof answer === 'string') return answer.trim().toLowerCase() !== String(value).trim().toLowerCase();
      return Number(answer) !== Number(value);
    case 'includes':
      return Array.isArray(answer) && answer.includes(value);
    case 'not_includes':
      return !Array.isArray(answer) || !answer.includes(value);
    case 'gte':
      return answered && Number(answer) >= Number(value);
    case 'lte':
      return answered && Number(answer) <= Number(value);
    default:
      return false;
  }
}

/**
 * Return the set of visible question ids given current answers.
 *
 * Conditions may only reference EARLIER questions (enforced by
 * validateSurveySchema), so a single forward pass resolves everything and
 * cycles are impossible. A question whose parent is hidden is also hidden,
 * even if the stale parent answer would satisfy the condition — that way
 * chains like A -> B -> C collapse correctly when A changes.
 */
export function getVisibleQuestionIds(schema, answers = {}) {
  const visible = new Set();
  for (const q of schema?.questions ?? []) {
    const c = q.condition;
    if (!c || !c.questionId) {
      visible.add(q.id);
      continue;
    }
    if (!visible.has(c.questionId)) continue;
    if (evaluateCondition(c, answers[c.questionId])) visible.add(q.id);
  }
  return visible;
}

export function getVisibleQuestions(schema, answers = {}) {
  const ids = getVisibleQuestionIds(schema, answers);
  return (schema?.questions ?? []).filter((q) => ids.has(q.id));
}

/**
 * Validate a survey schema. Returns { valid, errors } where errors is a list
 * of { path, questionId?, message } suitable for inline display in the builder.
 */
export function validateSurveySchema(schema) {
  const errors = [];
  const push = (message, questionId, path) => errors.push({ message, questionId, path });

  if (!isPlainObject(schema) || !Array.isArray(schema.questions)) {
    push('Schema must be an object with a "questions" array', undefined, 'questions');
    return { valid: false, errors };
  }
  const { questions } = schema;
  if (questions.length > LIMITS.maxQuestions) {
    push(`A survey can have at most ${LIMITS.maxQuestions} questions`, undefined, 'questions');
  }

  const seenIds = new Set();
  const byId = new Map();

  questions.forEach((q, index) => {
    const at = `questions[${index}]`;
    if (!isPlainObject(q)) {
      push(`Question ${index + 1} is malformed`, undefined, at);
      return;
    }
    const qid = q.id;
    if (!isNonEmptyString(qid) || !/^[A-Za-z0-9_-]{1,64}$/.test(qid)) {
      push(`Question ${index + 1} has an invalid id`, qid, `${at}.id`);
    } else if (seenIds.has(qid)) {
      push(`Question ${index + 1} has a duplicate id`, qid, `${at}.id`);
    }

    if (!QUESTION_TYPES.includes(q.type)) {
      push(`Question ${index + 1} has an unknown type`, qid, `${at}.type`);
    }
    if (!isNonEmptyString(q.label)) {
      push(`Question ${index + 1} needs a question text`, qid, `${at}.label`);
    } else if (q.label.length > LIMITS.maxLabel) {
      push(`Question ${index + 1} text is too long (max ${LIMITS.maxLabel})`, qid, `${at}.label`);
    }
    if (q.description != null && (typeof q.description !== 'string' || q.description.length > LIMITS.maxDescription)) {
      push(`Question ${index + 1} description is invalid`, qid, `${at}.description`);
    }
    if (typeof q.required !== 'boolean') {
      push(`Question ${index + 1} "required" must be true or false`, qid, `${at}.required`);
    }

    if (q.type === 'single' || q.type === 'multi') {
      if (!Array.isArray(q.options) || q.options.length < LIMITS.minOptions) {
        push(`Question ${index + 1} needs at least ${LIMITS.minOptions} options`, qid, `${at}.options`);
      } else {
        if (q.options.length > LIMITS.maxOptions) {
          push(`Question ${index + 1} has too many options (max ${LIMITS.maxOptions})`, qid, `${at}.options`);
        }
        const optIds = new Set();
        const optLabels = new Set();
        q.options.forEach((o, oi) => {
          if (!isPlainObject(o) || !isNonEmptyString(o.id) || !isNonEmptyString(o.label)) {
            push(`Question ${index + 1}, option ${oi + 1} needs a label`, qid, `${at}.options[${oi}]`);
            return;
          }
          if (o.label.length > LIMITS.maxOptionLabel) {
            push(`Question ${index + 1}, option ${oi + 1} is too long`, qid, `${at}.options[${oi}]`);
          }
          if (optIds.has(o.id)) push(`Question ${index + 1} has duplicate option ids`, qid, `${at}.options[${oi}]`);
          const norm = o.label.trim().toLowerCase();
          if (optLabels.has(norm)) push(`Question ${index + 1} has duplicate option "${o.label}"`, qid, `${at}.options[${oi}]`);
          optIds.add(o.id);
          optLabels.add(norm);
        });
      }
    }

    if (q.type === 'text' && q.maxLength != null) {
      if (!Number.isInteger(q.maxLength) || q.maxLength < 1 || q.maxLength > LIMITS.hardTextMaxLength) {
        push(`Question ${index + 1} max length must be 1–${LIMITS.hardTextMaxLength}`, qid, `${at}.maxLength`);
      }
    }

    // Conditional logic: may only depend on an EARLIER question.
    const c = q.condition;
    if (c != null) {
      if (!isPlainObject(c) || !isNonEmptyString(c.questionId)) {
        push(`Question ${index + 1} has an incomplete condition`, qid, `${at}.condition`);
      } else {
        const parent = byId.get(c.questionId);
        if (!parent) {
          const later = questions.some((other) => other?.id === c.questionId);
          push(
            later
              ? `Question ${index + 1} depends on a question that comes after it — move it below its trigger question`
              : `Question ${index + 1} depends on a question that no longer exists`,
            qid,
            `${at}.condition.questionId`,
          );
        } else {
          const allowed = OPERATORS_BY_TYPE[parent.type] ?? [];
          if (!allowed.includes(c.operator)) {
            push(`Question ${index + 1} has an unsupported condition operator`, qid, `${at}.condition.operator`);
          } else if (!VALUELESS_OPERATORS.has(c.operator)) {
            if (parent.type === 'single' || parent.type === 'multi') {
              if (!(parent.options ?? []).some((o) => o?.id === c.value)) {
                push(`Question ${index + 1} condition refers to an option that no longer exists`, qid, `${at}.condition.value`);
              }
            } else if (parent.type === 'rating') {
              const n = Number(c.value);
              if (!Number.isInteger(n) || n < RATING_MIN || n > RATING_MAX) {
                push(`Question ${index + 1} condition needs a rating between 1 and 5`, qid, `${at}.condition.value`);
              }
            } else if (!isNonEmptyString(String(c.value ?? ''))) {
              push(`Question ${index + 1} condition needs a value`, qid, `${at}.condition.value`);
            }
          }
        }
      }
    }

    if (isNonEmptyString(qid)) {
      seenIds.add(qid);
      byId.set(qid, q);
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Validate (and sanitise) a set of answers against a schema.
 *
 * - Answers to unknown or currently-hidden questions are DROPPED, so stale
 *   answers from a branch the respondent backed out of are never stored.
 * - In `partial` mode required-ness is not enforced (for autosave drafts),
 *   but types still are.
 *
 * Returns { valid, errors: { [questionId]: message }, answers: cleaned }.
 */
export function validateAnswers(schema, rawAnswers, { partial = false } = {}) {
  const errors = {};
  const cleaned = {};
  const answers = isPlainObject(rawAnswers) ? rawAnswers : {};
  const visible = getVisibleQuestionIds(schema, answers);

  for (const q of schema?.questions ?? []) {
    if (!visible.has(q.id)) continue;
    const value = answers[q.id];

    if (!isAnswered(value)) {
      if (q.required && !partial) errors[q.id] = 'This question is required';
      continue;
    }

    switch (q.type) {
      case 'text': {
        if (typeof value !== 'string') {
          errors[q.id] = 'Answer must be text';
          break;
        }
        const max = q.maxLength ?? LIMITS.defaultTextMaxLength;
        const trimmed = value.trim();
        if (trimmed.length > max) {
          errors[q.id] = `Answer must be at most ${max} characters`;
          break;
        }
        cleaned[q.id] = trimmed;
        break;
      }
      case 'single': {
        if (typeof value !== 'string' || !(q.options ?? []).some((o) => o.id === value)) {
          errors[q.id] = 'Please choose one of the options';
          break;
        }
        cleaned[q.id] = value;
        break;
      }
      case 'multi': {
        const optionIds = new Set((q.options ?? []).map((o) => o.id));
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !optionIds.has(v))) {
          errors[q.id] = 'Please choose from the listed options';
          break;
        }
        // de-duplicate while preserving option order
        cleaned[q.id] = (q.options ?? []).map((o) => o.id).filter((id) => value.includes(id));
        break;
      }
      case 'rating': {
        const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
        if (!Number.isInteger(n) || n < RATING_MIN || n > RATING_MAX) {
          errors[q.id] = `Rating must be a whole number from ${RATING_MIN} to ${RATING_MAX}`;
          break;
        }
        cleaned[q.id] = n;
        break;
      }
      default:
        errors[q.id] = 'Unknown question type';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, answers: cleaned };
}

/** Human-readable summary of a condition, for builder & form UIs. */
export function describeCondition(condition, questions) {
  if (!condition?.questionId) return '';
  const parent = questions.find((q) => q.id === condition.questionId);
  if (!parent) return 'Depends on a missing question';
  const idx = questions.indexOf(parent) + 1;
  const op = OPERATOR_LABELS[condition.operator] ?? condition.operator;
  if (VALUELESS_OPERATORS.has(condition.operator)) return `Shown if Q${idx} ${op}`;
  let value = condition.value;
  if (parent.type === 'single' || parent.type === 'multi') {
    value = parent.options?.find((o) => o.id === condition.value)?.label ?? '(missing option)';
  }
  return `Shown if Q${idx} ${op} "${value}"`;
}
