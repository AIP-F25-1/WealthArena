/**
 * Daily Data Update Scheduler
 * Runs once per day to update database from raw CSV files
 */

import { getDataPipelineService } from './dataPipelineService';
import cron from 'node-cron';

class DailyDataUpdateScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the daily scheduler
   * Runs at 2 AM UTC every day
   */
  start(): void {
    if (this.task) {
      console.log('Daily data update scheduler is already running');
      return;
    }

    // Schedule to run daily at 2 AM UTC
    // Format: minute hour day month day-of-week
    this.task = cron.schedule('0 2 * * *', async () => {
      await this.runUpdate();
    }, {
      scheduled: true,
      timezone: 'UTC',
    });

    console.log('✅ Daily data update scheduler started (runs daily at 2 AM UTC)');
    
    // Also run immediately on startup if data needs updating
    // Run asynchronously to avoid blocking
    (async () => {
      try {
        const dataPipelineService = getDataPipelineService();
        if (await dataPipelineService.shouldUpdate()) {
          console.log('Data needs updating, running initial update...');
          await this.runUpdate();
        }
      } catch (error) {
        console.warn('Failed to check if data needs updating on scheduler start:', error);
      }
    })();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('Daily data update scheduler stopped');
    }
  }

  /**
   * Run the update process
   */
  private async runUpdate(): Promise<void> {
    if (this.isRunning) {
      console.log('Update already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Starting daily database update from raw CSV files...');
      
      const dataPipelineService = getDataPipelineService();
      const result = await dataPipelineService.updateDatabaseFromRawFiles();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      if (result.success) {
        console.log(`✅ Database update completed successfully in ${duration}s`);
        console.log(`   - Symbols processed: ${result.symbolsProcessed}`);
        console.log(`   - Total records: ${result.totalRecords}`);
      } else {
        console.error(`❌ Database update completed with errors in ${duration}s`);
        console.error(`   - Symbols processed: ${result.symbolsProcessed}`);
        console.error(`   - Total records: ${result.totalRecords}`);
        console.error(`   - Errors: ${result.errors.length}`);
        result.errors.forEach(err => console.error(`     - ${err}`));
      }
    } catch (error: any) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`❌ Database update failed after ${duration}s:`, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger an update (for testing or manual runs)
   */
  async triggerUpdate(): Promise<void> {
    await this.runUpdate();
  }
}

// Singleton instance
let scheduler: DailyDataUpdateScheduler | null = null;

export function getDailyDataUpdateScheduler(): DailyDataUpdateScheduler {
  if (!scheduler) {
    scheduler = new DailyDataUpdateScheduler();
  }
  return scheduler;
}

