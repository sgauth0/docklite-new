export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Initialize database and run migrations on server startup
    const { initializeDatabase } = await import('./lib/db');
    initializeDatabase();
    console.log('[DockLite] Database initialized and migrations completed');
  }
}
