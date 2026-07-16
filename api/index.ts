import { app, setupDatabase } from "../server";

// Ensure database is initialized in serverless environment
setupDatabase();

export default app;
