import { init } from './lib/config';
import { setupBot } from './bot';
import { startServer } from './server';

init();
setupBot();
startServer();