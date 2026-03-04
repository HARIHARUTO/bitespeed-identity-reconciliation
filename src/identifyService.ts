import { Database } from "sqlite";
import { Contact } from "./db";

type IdentifyInput = {
  email: string | null;
  phoneNumber: string | null;
};

type ContactResponse = {
  contact: {
    primaryContatctId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
};

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    out.push(value);
  }

  return out;
}

async function getContactById(db: Database, id: number): Promise<Contact> {
  const row = await db.get<Contact>("SELECT * FROM Contact WHERE id = ?", [id]);

  if (!row) {
    throw new Error(`Contact ${id} not found`);
  }

  return row;
}

async function findMatchingContacts(db: Database, input: IdentifyInput): Promise<Contact[]> {
  const clauses: string[] = ["deletedAt IS NULL"];
  const params: string[] = [];
  const matchers: string[] = [];

  if (input.email) {
    matchers.push("email = ?");
    params.push(input.email);
  }

  if (input.phoneNumber) {
    matchers.push("phoneNumber = ?");
    params.push(input.phoneNumber);
  }

  if (matchers.length === 0) {
    return [];
  }

  clauses.push(`(${matchers.join(" OR ")})`);

  return db.all<Contact[]>(
    `
    SELECT * FROM Contact
    WHERE ${clauses.join(" AND ")}
    ORDER BY datetime(createdAt) ASC, id ASC
    `,
    params
  );
}

async function insertContact(
  db: Database,
  payload: {
    email: string | null;
    phoneNumber: string | null;
    linkPrecedence: "primary" | "secondary";
    linkedId: number | null;
  }
): Promise<number> {
  const ts = nowIso();
  const result = await db.run(
    `
    INSERT INTO Contact (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt)
    VALUES (?, ?, ?, ?, ?, ?, NULL)
    `,
    [payload.phoneNumber, payload.email, payload.linkedId, payload.linkPrecedence, ts, ts]
  );

  return result.lastID as number;
}

async function mergePrimaryInto(db: Database, olderPrimaryId: number, newerPrimaryId: number): Promise<void> {
  const ts = nowIso();

  await db.run(
    `
    UPDATE Contact
    SET linkedId = ?, linkPrecedence = 'secondary', updatedAt = ?
    WHERE id = ?
    `,
    [olderPrimaryId, ts, newerPrimaryId]
  );

  await db.run(
    `
    UPDATE Contact
    SET linkedId = ?, updatedAt = ?
    WHERE linkedId = ?
    `,
    [olderPrimaryId, ts, newerPrimaryId]
  );
}

async function loadCluster(db: Database, primaryId: number): Promise<Contact[]> {
  return db.all<Contact[]>(
    `
    SELECT * FROM Contact
    WHERE deletedAt IS NULL AND (id = ? OR linkedId = ?)
    ORDER BY datetime(createdAt) ASC, id ASC
    `,
    [primaryId, primaryId]
  );
}

function pickOldestPrimary(candidates: Contact[]): Contact {
  const primaries = candidates
    .filter((c) => c.linkPrecedence === "primary")
    .sort((a, b) => {
      const byDate = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      return byDate !== 0 ? byDate : a.id - b.id;
    });

  if (primaries.length === 0) {
    throw new Error("No primary contacts found in candidates");
  }

  return primaries[0];
}

function buildResponse(primary: Contact, allContacts: Contact[]): ContactResponse {
  const primaryEmail = primary.email ? [primary.email] : [];
  const primaryPhone = primary.phoneNumber ? [primary.phoneNumber] : [];

  const secondaryContacts = allContacts.filter((c) => c.id !== primary.id);

  const emails = uniqueStrings([
    ...primaryEmail,
    ...secondaryContacts.map((c) => c.email)
  ]);

  const phoneNumbers = uniqueStrings([
    ...primaryPhone,
    ...secondaryContacts.map((c) => c.phoneNumber)
  ]);

  const secondaryContactIds = secondaryContacts.map((c) => c.id);

  return {
    contact: {
      primaryContatctId: primary.id,
      emails,
      phoneNumbers,
      secondaryContactIds
    }
  };
}

export async function identifyContact(db: Database, input: IdentifyInput): Promise<ContactResponse> {
  let matches = await findMatchingContacts(db, input);

  if (matches.length === 0) {
    const newPrimaryId = await insertContact(db, {
      email: input.email,
      phoneNumber: input.phoneNumber,
      linkPrecedence: "primary",
      linkedId: null
    });

    const primary = await getContactById(db, newPrimaryId);
    return buildResponse(primary, [primary]);
  }

  const matchedPrimaryIds = Array.from(
    new Set(matches.map((m) => (m.linkPrecedence === "primary" ? m.id : m.linkedId as number)))
  );

  const matchedPrimaries = await db.all<Contact[]>(
    `
    SELECT * FROM Contact
    WHERE id IN (${matchedPrimaryIds.map(() => "?").join(",")})
    ORDER BY datetime(createdAt) ASC, id ASC
    `,
    matchedPrimaryIds
  );

  const oldestPrimary = pickOldestPrimary(matchedPrimaries);

  for (const candidate of matchedPrimaries) {
    if (candidate.id !== oldestPrimary.id) {
      await mergePrimaryInto(db, oldestPrimary.id, candidate.id);
    }
  }

  let cluster = await loadCluster(db, oldestPrimary.id);

  const existingEmails = new Set(cluster.map((c) => c.email).filter(Boolean) as string[]);
  const existingPhones = new Set(cluster.map((c) => c.phoneNumber).filter(Boolean) as string[]);

  const hasNewEmail = Boolean(input.email && !existingEmails.has(input.email));
  const hasNewPhone = Boolean(input.phoneNumber && !existingPhones.has(input.phoneNumber));

  if (hasNewEmail || hasNewPhone) {
    await insertContact(db, {
      email: input.email,
      phoneNumber: input.phoneNumber,
      linkPrecedence: "secondary",
      linkedId: oldestPrimary.id
    });

    cluster = await loadCluster(db, oldestPrimary.id);
  }

  const primary = cluster.find((c) => c.id === oldestPrimary.id);
  if (!primary) {
    throw new Error("Primary contact missing from cluster");
  }

  return buildResponse(primary, cluster);
}
