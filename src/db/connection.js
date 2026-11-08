import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));

export function createDatabase(
  databasePath = process.env.DATABASE_PATH ?? "data/events.db",
) {
  const resolvedPath =
    databasePath === ":memory:" ? databasePath : resolve(databasePath);
  if (resolvedPath !== ":memory:")
    mkdirSync(resolve(resolvedPath, ".."), { recursive: true });

  const database = new DatabaseSync(resolvedPath);
  database.exec(readFileSync(schemaPath, "utf8"));
  return database;
}
