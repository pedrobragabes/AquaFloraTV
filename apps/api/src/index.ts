import { app } from './server.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`AquaTV API on :${env.PORT}`);
});
