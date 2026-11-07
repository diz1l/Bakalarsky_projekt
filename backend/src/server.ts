import { createApp } from './app.js';
import { config } from './config.js';
import { startScheduledJobs } from './cron.js';

startScheduledJobs();
createApp().listen(config.port, () => {
  console.log(`Staff Manager API listening on http://localhost:${config.port}/api`);
});
