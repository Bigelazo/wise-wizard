import { PrismaPg } from "@prisma/adapter-pg";
import { connection } from "next/server";
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
  }),
});

export async function GET() {
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "up" });
  } catch (error) {
    console.error(error);
    return Response.json({ status: "error", db: "down" }, { status: 503 });
  }
}
