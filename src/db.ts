import sqlite3 from "sqlite3";
import { Database, open } from "sqlite";

export type Contact = {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: "primary" | "secondary";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export async function initDatabase(filename: string): Promise<Database> {
  const db = await open({
    filename,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Contact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phoneNumber TEXT,
      email TEXT,
      linkedId INTEGER,
      linkPrecedence TEXT NOT NULL CHECK(linkPrecedence IN ('primary', 'secondary')),
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_contact_email ON Contact(email);
    CREATE INDEX IF NOT EXISTS idx_contact_phone ON Contact(phoneNumber);
    CREATE INDEX IF NOT EXISTS idx_contact_linked ON Contact(linkedId);
  `);

  return db;
}
