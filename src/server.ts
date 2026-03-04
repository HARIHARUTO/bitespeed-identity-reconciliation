import { initDatabase } from "./db";
import { createApp } from "./app";

async function bootstrap() {
  const dbPath = process.env.DB_PATH ?? "./contacts.db";
  const port = Number(process.env.PORT ?? 3000);

  const db = await initDatabase(dbPath);
  const app = createApp(db);

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
