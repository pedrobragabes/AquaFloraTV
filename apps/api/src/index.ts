import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api' });
});

app.get('/', (_req, res) => {
  res.send('AquaTV API placeholder');
});

app.listen(port, () => {
  console.log(`AquaTV API on :${port}`);
});
