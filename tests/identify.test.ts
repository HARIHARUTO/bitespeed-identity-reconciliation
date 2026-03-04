import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { Database } from "sqlite";
import { createApp } from "../src/app";
import { initDatabase } from "../src/db";

let db: Database;

beforeEach(async () => {
  db = await initDatabase(":memory:");
});

describe("POST /identify", () => {
  it("creates a primary contact for a new identity", async () => {
    const app = createApp(db);

    const response = await request(app).post("/identify").send({
      email: "doc@future.com",
      phoneNumber: "123456"
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      contact: {
        primaryContatctId: 1,
        emails: ["doc@future.com"],
        phoneNumbers: ["123456"],
        secondaryContactIds: []
      }
    });
  });

  it("creates secondary contact when incoming request has new info", async () => {
    const app = createApp(db);

    await request(app).post("/identify").send({
      email: "lorraine@hillvalley.edu",
      phoneNumber: "123456"
    });

    const second = await request(app).post("/identify").send({
      email: "mcfly@hillvalley.edu",
      phoneNumber: "123456"
    });

    expect(second.status).toBe(200);
    expect(second.body).toEqual({
      contact: {
        primaryContatctId: 1,
        emails: ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
        phoneNumbers: ["123456"],
        secondaryContactIds: [2]
      }
    });
  });

  it("merges two primary contacts when a bridging request arrives", async () => {
    const app = createApp(db);

    await request(app).post("/identify").send({
      email: "george@hillvalley.edu",
      phoneNumber: "919191"
    });

    await request(app).post("/identify").send({
      email: "biffsucks@hillvalley.edu",
      phoneNumber: "717171"
    });

    const merged = await request(app).post("/identify").send({
      email: "george@hillvalley.edu",
      phoneNumber: "717171"
    });

    expect(merged.status).toBe(200);
    expect(merged.body).toEqual({
      contact: {
        primaryContatctId: 1,
        emails: ["george@hillvalley.edu", "biffsucks@hillvalley.edu"],
        phoneNumbers: ["919191", "717171"],
        secondaryContactIds: [2]
      }
    });
  });
});
