import cron from 'node-cron';
import { listContainers, startContainer } from './docker';

const HEALTH_CHECK_INTERVAL = '*/2 * * * *';

async function healStoppedContainers(): Promise<void> {
  try {
    const containers = await listContainers(true);
    const stopped = containers.filter(container => container.state !== 'running');

    for (const container of stopped) {
      try {
        await startContainer(container.id);
        console.log(`✓ Auto-started container ${container.name}`);
      } catch (error: any) {
        console.error(`✗ Failed to auto-start ${container.name}:`, error.message || error);
      }
    }
  } catch (error: any) {
    console.error('Error checking container health:', error.message || error);
  }
}

export function startContainerMonitor(): void {
  console.log('🔄 Starting container monitor (checks every 2 minutes)...');

  cron.schedule(HEALTH_CHECK_INTERVAL, () => {
    console.log('⏰ Checking for stopped containers...');
    healStoppedContainers().catch(err => {
      console.error('Error during container health check:', err);
    });
  });

  setTimeout(() => {
    console.log('⏰ Running initial container health check...');
    healStoppedContainers().catch(err => {
      console.error('Error during initial container health check:', err);
    });
  }, 30000);
}
