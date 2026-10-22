import { createApp } from './app.js';
import { env } from './config/env.js';
import { runMaintenance } from './services/maintenance.js';

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`API http://localhost:${env.PORT} üzerinde çalışıyor (${env.NODE_ENV})`);
});

// Saatte bir süresi dolan oturum/token ve eski erişim kayıtlarını temizle.
const tick = () => runMaintenance().catch((e) => console.error('[bakım]', e.message));
tick();
setInterval(tick, 3_600_000).unref();
