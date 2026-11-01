import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Local runs read .env; Docker and CI pass DATABASE_URL in the environment.
if (existsSync(".env")) process.loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
