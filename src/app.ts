import express from "express";
import { z } from "zod";
import { Database } from "sqlite";
import { identifyContact } from "./identifyService";

const identifySchema = z
  .object({
    email: z.string().trim().email().nullable().optional(),
    phoneNumber: z.union([z.string().trim(), z.number()]).nullable().optional()
  })
  .refine((value) => value.email != null || value.phoneNumber != null, {
    message: "Either email or phoneNumber is required"
  });

export function createApp(db: Database) {
  const app = express();

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.status(200).json({ message: "Bitespeed Identity Reconciliation API is running" });
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post("/identify", async (req, res) => {
    const parsed = identifySchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const payload = parsed.data;

    const email = payload.email ?? null;
    const phoneNumber = payload.phoneNumber == null ? null : String(payload.phoneNumber);

    try {
      const response = await identifyContact(db, { email, phoneNumber });
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return app;
}
