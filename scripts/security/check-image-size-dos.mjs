import { spawnSync } from 'node:child_process';

const cases = {
  icnsZeroLength: Buffer.from('69636e73000000106963303700000000', 'hex'),
  jxlZeroLengthBox: Buffer.concat([
    Buffer.from('0000000c4a584c2000000000', 'hex'),
    Buffer.from('0000000c667479706a786c20', 'hex'),
    Buffer.from('000000006a786c70', 'hex'),
  ]),
  heifZeroLengthBox: Buffer.from('000000006674797061766966', 'hex'),
};

const childSource = `
  const { imageSize } = require('image-size');
  try { imageSize(Buffer.from(process.argv[1], 'hex')); } catch {}
`;

for (const [name, payload] of Object.entries(cases)) {
  const result = spawnSync(process.execPath, ['-e', childSource, payload.toString('hex')], {
    timeout: 1_500,
  });

  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error(`${name} blocked the Node.js event loop`);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${name} exited unexpectedly: ${result.stderr.toString()}`);
  }
}

console.log('image-size denial-of-service regression checks passed');
