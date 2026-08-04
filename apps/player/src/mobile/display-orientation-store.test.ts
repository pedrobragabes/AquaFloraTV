import test from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultDisplayRotation,
  displayRotationLabel,
  isDisplayRotation,
  nextDisplayRotation,
  parseDisplayRotation,
  type DisplayRotation,
} from './display-orientation';

test('usa portrait como orientação inicial da instalação vertical', () => {
  assert.equal(defaultDisplayRotation, 90);
});

test('aceita somente os quatro modos suportados', () => {
  assert.equal(isDisplayRotation(0), true);
  assert.equal(isDisplayRotation(90), true);
  assert.equal(isDisplayRotation(270), true);
  assert.equal(isDisplayRotation('system'), true);
  assert.equal(isDisplayRotation(180), false);
  assert.equal(isDisplayRotation('90'), false);
});

test('cicla horizontal, portrait A, portrait B e volta ao início', () => {
  const sequence: DisplayRotation[] = [0, 90, 270];
  assert.equal(nextDisplayRotation('system'), 0);
  assert.deepEqual(
    sequence.map((rotation) => nextDisplayRotation(rotation)),
    [90, 270, 'system'],
  );
  assert.equal(nextDisplayRotation(270), 'system');
});

test('exibe nomes estáveis para o painel', () => {
  assert.equal(displayRotationLabel('system'), 'Automatica / sistema');
  assert.equal(displayRotationLabel(0), 'Horizontal');
  assert.equal(displayRotationLabel(90), 'Vertical - lado A');
  assert.equal(displayRotationLabel(270), 'Vertical - lado B');
});

test('usa o padrão para preferência ausente, inválida ou antiga', () => {
  assert.equal(parseDisplayRotation(null), defaultDisplayRotation);
  assert.equal(parseDisplayRotation('not-json'), defaultDisplayRotation);
  assert.equal(parseDisplayRotation(JSON.stringify('portrait-a')), defaultDisplayRotation);
  assert.equal(parseDisplayRotation(JSON.stringify(90)), 90);
  assert.equal(parseDisplayRotation(JSON.stringify('system')), 'system');
});
