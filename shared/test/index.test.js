import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSurveySchema, validateAnswers, getVisibleQuestionIds, evaluateCondition } from '../src/index.js';

const schema = {
  questions: [
    {
      id: 'q_a',
      type: 'single',
      label: 'Do you own a pet?',
      required: true,
      options: [
        { id: 'o_yes', label: 'Yes' },
        { id: 'o_no', label: 'No' },
      ],
    },
    {
      id: 'q_b',
      type: 'multi',
      label: 'Which pets?',
      required: true,
      options: [
        { id: 'o_dog', label: 'Dog' },
        { id: 'o_cat', label: 'Cat' },
      ],
      condition: { questionId: 'q_a', operator: 'equals', value: 'o_yes' },
    },
    {
      id: 'q_c',
      type: 'text',
      label: "Dog's name?",
      required: false,
      condition: { questionId: 'q_b', operator: 'includes', value: 'o_dog' },
    },
    { id: 'q_d', type: 'rating', label: 'Rate us', required: true },
  ],
};

test('valid schema passes', () => {
  const r = validateSurveySchema(schema);
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
});

test('condition must reference an earlier question', () => {
  const bad = { questions: [schema.questions[1], schema.questions[0]] };
  const r = validateSurveySchema(bad);
  assert.equal(r.valid, false);
  assert.match(r.errors[0].message, /comes after it/);
});

test('condition must reference an existing option', () => {
  const bad = structuredClone(schema);
  bad.questions[1].condition.value = 'o_gone';
  const r = validateSurveySchema(bad);
  assert.equal(r.valid, false);
  assert.match(r.errors[0].message, /option that no longer exists/);
});

test('choice questions need 2+ unique options', () => {
  const r = validateSurveySchema({
    questions: [{ id: 'q1', type: 'single', label: 'X', required: false, options: [{ id: 'a', label: 'A' }] }],
  });
  assert.equal(r.valid, false);
  const r2 = validateSurveySchema({
    questions: [
      {
        id: 'q1',
        type: 'single',
        label: 'X',
        required: false,
        options: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'a' },
        ],
      },
    ],
  });
  assert.equal(r2.valid, false);
});

test('duplicate question ids rejected', () => {
  const r = validateSurveySchema({
    questions: [
      { id: 'q1', type: 'text', label: 'X', required: false },
      { id: 'q1', type: 'text', label: 'Y', required: false },
    ],
  });
  assert.equal(r.valid, false);
});

test('visibility follows conditional chains', () => {
  assert.deepEqual([...getVisibleQuestionIds(schema, {})], ['q_a', 'q_d']);
  assert.deepEqual([...getVisibleQuestionIds(schema, { q_a: 'o_yes' })], ['q_a', 'q_b', 'q_d']);
  assert.deepEqual([...getVisibleQuestionIds(schema, { q_a: 'o_yes', q_b: ['o_dog'] })], ['q_a', 'q_b', 'q_c', 'q_d']);
  // Parent hidden -> child hidden even with stale answers that would match.
  assert.deepEqual([...getVisibleQuestionIds(schema, { q_a: 'o_no', q_b: ['o_dog'] })], ['q_a', 'q_d']);
});

test('required enforced only for visible questions', () => {
  const r = validateAnswers(schema, { q_a: 'o_no', q_d: 4 });
  assert.equal(r.valid, true);
  const r2 = validateAnswers(schema, { q_a: 'o_yes', q_d: 4 });
  assert.equal(r2.valid, false);
  assert.ok(r2.errors.q_b);
});

test('hidden answers are stripped', () => {
  const r = validateAnswers(schema, { q_a: 'o_no', q_b: ['o_dog'], q_c: 'Rex', q_d: 5, junk: 1 });
  assert.deepEqual(r.answers, { q_a: 'o_no', q_d: 5 });
});

test('type checking', () => {
  assert.ok(validateAnswers(schema, { q_a: 'o_nope', q_d: 3 }).errors.q_a);
  assert.ok(validateAnswers(schema, { q_a: 'o_no', q_d: 6 }).errors.q_d);
  assert.ok(validateAnswers(schema, { q_a: 'o_no', q_d: 2.5 }).errors.q_d);
  assert.ok(validateAnswers(schema, { q_a: 'o_yes', q_b: 'o_dog', q_d: 3 }).errors.q_b);
  assert.ok(validateAnswers(schema, { q_a: 'o_yes', q_b: ['o_dog'], q_c: 42, q_d: 3 }).errors.q_c);
});

test('partial mode skips required checks but keeps type checks', () => {
  assert.equal(validateAnswers(schema, {}, { partial: true }).valid, true);
  assert.equal(validateAnswers(schema, { q_d: 9 }, { partial: true }).valid, false);
});

test('multi answers are de-duplicated and ordered', () => {
  const r = validateAnswers(schema, { q_a: 'o_yes', q_b: ['o_cat', 'o_dog', 'o_cat'], q_d: 1 });
  assert.deepEqual(r.answers.q_b, ['o_dog', 'o_cat']);
});

test('operators', () => {
  assert.equal(evaluateCondition({ operator: 'gte', value: 4 }, 5), true);
  assert.equal(evaluateCondition({ operator: 'lte', value: 2 }, 3), false);
  assert.equal(evaluateCondition({ operator: 'not_equals', value: 'o_yes' }, undefined), true);
  assert.equal(evaluateCondition({ operator: 'equals', value: 'Yes' }, ' yes '), true);
  assert.equal(evaluateCondition({ operator: 'answered' }, ''), false);
  assert.equal(evaluateCondition({ operator: 'not_includes', value: 'x' }, ['y']), true);
});
