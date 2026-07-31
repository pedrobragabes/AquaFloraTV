import assert from 'node:assert/strict';
import test from 'node:test';

import { isInsideRecurringWindow } from './schedule-window.js';

function localDate(day: number, hours: number, minutes = 0): Date {
  const date = new Date(2026, 6, 26 + day, hours, minutes, 0, 0);
  assert.equal(date.getDay(), day);
  return date;
}

test('aplica horario mesmo quando a regra vale todos os dias', () => {
  assert.equal(isInsideRecurringWindow(localDate(1, 8), [], '09:00', '18:00'), false);
  assert.equal(isInsideRecurringWindow(localDate(1, 12), [], '09:00', '18:00'), true);
});

test('aplica dias da semana mesmo quando a regra vale o dia inteiro', () => {
  assert.equal(isInsideRecurringWindow(localDate(1, 12), [1, 2, 3, 4, 5], null, null), true);
  assert.equal(isInsideRecurringWindow(localDate(0, 12), [1, 2, 3, 4, 5], null, null), false);
});

test('rejeita horario incompleto ou invalido', () => {
  assert.equal(isInsideRecurringWindow(localDate(1, 12), [], '09:00', null), false);
  assert.equal(isInsideRecurringWindow(localDate(1, 12), [], '25:00', '26:00'), false);
});

test('janela noturna usa o dia em que a programacao comecou', () => {
  assert.equal(isInsideRecurringWindow(localDate(1, 23), [1], '22:00', '04:00'), true);
  assert.equal(isInsideRecurringWindow(localDate(2, 2), [1], '22:00', '04:00'), true);
  assert.equal(isInsideRecurringWindow(localDate(2, 5), [1], '22:00', '04:00'), false);
});
