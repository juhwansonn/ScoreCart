#!/usr/bin/env node
"use strict";

let port = process.env.PORT || 8000;

if (require.main === module) {
  const args = process.argv;

  if (args.length === 3) {
    const num = parseInt(args[2], 10);
    if (!isNaN(num)) {
      port = num;
    } else {
        console.error("error: argument must be an integer.");
        process.exit(1);
    }
  }
}

require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { URLSearchParams } = require("url");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
app.set("query parser", "extended");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const requireAuthenticatedUser = require("./middleware/auth.js");
const SIGNING_SECRET = process.env.JWT_SECRET;
const resetRequestBudget = {};
const ROLE_RANKS = { regular: 0, cashier: 1, manager: 2, superuser: 3 };
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function issueToken(utorid, time) {
  const token = jwt.sign({ username: utorid }, SIGNING_SECRET, { expiresIn: time });

  return token;
}

function enforceRoleClearance(min_level) {
  return function (req, res, next) {
    const curr_level = (req.user.role || "").toLowerCase();

    if (!ROLE_RANKS.hasOwnProperty(curr_level)) {
      return res.status(403).json({ error: "Insufficient access level" });
    }

    req.user.role = curr_level;

    if (ROLE_RANKS[curr_level] < ROLE_RANKS[min_level]) {
      return res.status(403).json({ error: "Insufficient access level" });
    }

    next();
  };
}

function validPassword(password) {
  let RegEx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

  return password.length >= 8 && password.length <= 20 && RegEx.test(password);
}

const VALID_UOFT_DOMAINS = ["@mail.utoronto.ca", "@utoronto.ca"];

function normalizeCampusEmail(rawEmail) {
  if (typeof rawEmail !== "string") {
    return null;
  }

  const normalized = rawEmail.trim().toLowerCase();
  return VALID_UOFT_DOMAINS.some((domain) => normalized.endsWith(domain))
    ? normalized
    : null;
}

function parseBirthdayIsoDate(rawBirthday) {
  if (typeof rawBirthday !== "string") {
    return null;
  }

  const trimmed = rawBirthday.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);

  if (!match) {
    return null;
  }

  const datePart = match[1];
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const isoDate = parsed.toISOString().slice(0, 10);
  if (isoDate !== datePart) {
    return null;
  }

  return parsed;
}

function formatIsoDateOnly(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function formatIsoDateTime(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function interpretBooleanFlag(value) {
  if (Array.isArray(value)) {
    if (!value.length) {
      return null;
    }
    return interpretBooleanFlag(value[value.length - 1]);
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(lower)) return true;
    if (["false", "0", "no"].includes(lower)) return false;
  }
  return null;
}

function parsePositiveWhole(value) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parsePositiveWholeegerStrict(value) {
  const parsedNumber = Number(value);
  if (!Number.isInteger(parsedNumber) || parsedNumber <= 0) {
    return null;
  }
  return parsedNumber;
}

function mergeFilterSources(query = {}, body = {}) {
  const merged = {};
  const append = (source) => {
    if (!source || typeof source !== "object") {
      return;
    }
    for (const [key, value] of Object.entries(source)) {
      if (typeof key === "string" && key.toLowerCase().startsWith("filters.")) {
        const innerKey = key.slice(key.indexOf(".") + 1);
        if (innerKey) {
          merged[innerKey] = value;
          continue;
        }
      }
      if (
        typeof key === "string" &&
        key.toLowerCase().startsWith("filters[")
      ) {
        const closingIndex = key.indexOf("]");
        if (closingIndex > 8) {
          const innerKey = key.slice(8, closingIndex);
          if (innerKey) {
            merged[innerKey] = value;
            continue;
          }
        }
      }
      if (typeof key === "string" && key.endsWith("[]")) {
        const trimmed = key.slice(0, -2);
        if (trimmed) {
          if (merged[trimmed] === undefined) {
            merged[trimmed] = value;
          }
          continue;
        }
      }
      if (value === undefined) {
        continue;
      }
      if (typeof key === "string" && key.toLowerCase() === "filters") {
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          append(value);
          continue;
        }
        if (typeof value === "string") {
          const trimmedValue = value.trim();
          let parsedObject = null;
          if (
            trimmedValue.startsWith("{") &&
            trimmedValue.endsWith("}")
          ) {
            try {
              const parsed = JSON.parse(trimmedValue);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                parsedObject = parsed;
              }
            } catch (err) {
              parsedObject = null;
            }
          }
          if (!parsedObject && trimmedValue.includes("=")) {
            const params = new URLSearchParams(trimmedValue);
            const obj = {};
            for (const [paramKey, paramValue] of params.entries()) {
              obj[paramKey] = paramValue;
            }
            parsedObject = obj;
          }
          if (parsedObject) {
            append(parsedObject);
            continue;
          }
        }
      }
      if (
        typeof key === "string" &&
        key.toLowerCase() === "filters" &&
        typeof value !== "object"
      ) {
        continue;
      }
      if (merged[key] === undefined) {
        merged[key] = value;
      }
    }
  };

  append(query);
  append(body);
  return merged;
}

function normalizeFiltersInput(input) {
  if (input === null || input === undefined) {
    return null;
  }
  if (Array.isArray(input)) {
    const normalized = input
      .map((entry) => normalizeFiltersInput(entry))
      .filter(Boolean);
    if (normalized.length === 0) {
      return null;
    }
    if (normalized.length === 1) {
      return normalized[0];
    }
    return normalized;
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      } catch (err) {
        return null;
      }
    }
    try {
      const params = new URLSearchParams(
        trimmed.startsWith("?") ? trimmed.slice(1) : trimmed
      );
      const obj = {};
      for (const [key, value] of params.entries()) {
        obj[key] = value;
      }
      return Object.keys(obj).length ? obj : null;
    } catch (err) {
      return null;
    }
  }
  if (typeof input === "object") {
    return input;
  }
  return null;
}

function extractFiltersFromQuery(req) {
  if (!req || !req.originalUrl) {
    return null;
  }
  const queryIndex = req.originalUrl.indexOf("?");
  if (queryIndex === -1) {
    return null;
  }
  const queryString = req.originalUrl.slice(queryIndex + 1);
  if (!queryString) {
    return null;
  }
  const params = new URLSearchParams(queryString);
  const computed = {};
  for (const [name, value] of params.entries()) {
    const lowered = name.toLowerCase();
    if (lowered.startsWith("filters[")) {
      const closingIndex = name.indexOf("]");
      if (closingIndex > 8) {
        const innerKey = name.slice(8, closingIndex);
        if (innerKey) {
          computed[innerKey] = value;
          continue;
        }
      }
    } else if (lowered.startsWith("filters.")) {
      const innerKey = name.slice(name.indexOf(".") + 1);
      if (innerKey) {
        computed[innerKey] = value;
        continue;
      }
    } else if (name.endsWith("[]")) {
      const trimmed = name.slice(0, -2);
      if (trimmed) {
        computed[trimmed] = value;
        continue;
      }
    }
    computed[name] = value;
  }
  return Object.keys(computed).length ? computed : null;
}

function digFilterValue(source, key) {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }
  const lowered = key.toLowerCase();
  for (const [candidate, value] of Object.entries(source)) {
    const normalized = candidate.toLowerCase();
    if (
      normalized === lowered ||
      normalized === `${lowered}[]` ||
      normalized.startsWith(`${lowered}[`) ||
      normalized.startsWith(`${lowered}.`)
    ) {
      return value;
    }
  }
  const filtersValue = source.filters;
  if (filtersValue && typeof filtersValue === "object") {
    if (Array.isArray(filtersValue)) {
      for (const entry of filtersValue) {
        const result = digFilterValue(entry, key);
        if (result !== undefined) {
          return result;
        }
      }
    } else {
      const nestedResult = digFilterValue(filtersValue, key);
      if (nestedResult !== undefined) {
        return nestedResult;
      }
    }
  }
  return undefined;
}

function resolveFilterInput(filters, req, key) {
  const potentialSources = [
    filters,
    req?.query,
    req?.body,
    normalizeFiltersInput(req?.query?.filters),
    normalizeFiltersInput(req?.body?.filters),
    extractFiltersFromQuery(req),
  ];

  for (const source of potentialSources) {
    const value = digFilterValue(source, key);
    if (value !== undefined) {
      return value;
    }
  }

  return (
    req?.query?.[`filters[${key}]`] ??
    req?.query?.[`filters.${key}`] ??
    req?.body?.[`filters[${key}]`] ??
    req?.body?.[`filters.${key}`]
  );
}

function normalizeRoleToken(role) {
  if (typeof role !== "string") {
    return null;
  }
  const lower = role.trim().toLowerCase();
  return ROLE_RANKS.hasOwnProperty(lower) ? lower : null;
}

function coalesceNullable(value) {
  return value === null ? undefined : value;
}

function hasEventReachedCapacity(event) {
  if (!event) {
    return false;
  }
  if (event.capacity === null || event.capacity === undefined) {
    return false;
  }
  const guestCount = Array.isArray(event.guests) ? event.guests.length : 0;
  return guestCount >= event.capacity;
}

async function fetchEventCapacitySnapshot(eventId) {
  const snapshot = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      capacity: true,
      _count: {
        select: { guests: true },
      },
    },
  });

  if (!snapshot) {
    return false;
  }

  if (snapshot.capacity === null || snapshot.capacity === undefined) {
    return false;
  }

  return snapshot._count.guests >= snapshot.capacity;
}

function composeTransactionResponse(transaction, options = {}) {
  const {
    includeSuspicious = true,
    includeName = false,
    includeCreatedAt = false,
  } = options;

  const lowerType = (transaction.type || "").toLowerCase();
  const payload = {
    id: transaction.id,
    utorid: transaction.utorid,
    type: transaction.type,
    amount:
      lowerType === "event"
        ? transaction.earned ?? transaction.amount ?? 0
        : transaction.amount,
    promotionIds: (transaction.promotions || []).map((promotion) => promotion.id),
    remark: transaction.remark,
    createdBy: transaction.createdBy,
  };

  if (transaction.spent !== undefined) {
    payload.spent = transaction.spent;
  }

  if (
    ["adjustment", "transfer", "redemption", "event"].includes(lowerType)
  ) {
    payload.relatedId = transaction.relatedId;
  }

  if (lowerType === "redemption") {
    payload.redeemed = transaction.amount;
    payload.processedBy = transaction.processedBy || null;
  }

  if (includeSuspicious) {
    payload.suspicious = transaction.suspicious;
  }

  if (includeCreatedAt) {
    payload.createdAt = transaction.createdAt;
  }

  if (includeName) {
    payload.name = transaction.user?.name || null;
  }

  return payload;
}

function derivePromotionBonus(promotion, spent) {
  let bonus = 0;
  if (typeof promotion.points === "number") {
    bonus += promotion.points;
  }
  if (typeof promotion.rate === "number") {
    const cents = Math.round(spent * 100);
    bonus += Math.round(cents * promotion.rate);
  }
  return bonus;
}

async function collectAvailablePromotions(userId) {
  if (!userId) {
    return [];
  }

  const now = new Date();
  const candidates = await prisma.promotion.findMany({
    where: {
      OR: [{ isOneTime: true }, { type: "onetime" }],
      startTime: { lte: now },
      endTime: { gte: now },
    },
    select: {
      id: true,
      name: true,
      minSpending: true,
      rate: true,
      points: true,
      description: true,
    },
  });

  const used = await prisma.usage.findMany({
    where: { userId },
    select: { promotionId: true },
  });

  const usedIds = new Set(used.map((u) => u.promotionId));
  return candidates.filter((promotion) => !usedIds.has(promotion.id));
}

async function fetchEventOrError(req, res, include) {
  const eventId = parsePositiveWhole(req.params.eventId);
  if (!eventId) {
    res.status(404).json({ error: "Event not found" });
    return null;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include,
  });

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return null;
  }

  return { eventId, event };
}


app.post(
  "/users",
  requireAuthenticatedUser,
  enforceRoleClearance("cashier"),
  async (req, res) => {
    const { utorid, name, email, password } = req.body;

    if (!utorid || !name || !email) {
      return res.status(400).json({ error: "Payload field missing" });
    }

    const utoridRegex = /^[a-z0-9]+$/i;
    const isUtoridAlphanumeric = utoridRegex.test(utorid);

    if (utorid.length < 7 || utorid.length > 8 || !isUtoridAlphanumeric) {
      return res.status(400).json({ error: "utorid entered incorrect" });
    }

    if (name.length == 0 || name.length > 50) {
      return res
        .status(400)
        .json({ error: "name must be between 1 and 50 characters" });
    }

    const normalizedEmail = normalizeCampusEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email not proper format" });
    }

    try {
      const existingUser = await prisma.user.findUnique({
        where: { utorid },
      });

      if (existingUser) {
        return res
          .status(409)
          .json({ message: "A user with that utorid already exists" });
      }

      const createdAtIso = new Date().toISOString();

      const finalPassword = password || "Password123!";
      
      const isVerified = true; 

      const newUser = await prisma.user.create({
        data: {
          utorid,
          name,
          email: normalizedEmail,
          role: "regular",
          points: 0,
          suspicious: false,
          
          password: finalPassword,
          verified: isVerified,
          token: null,
          createdAt: createdAtIso,
          expiresAt: null,
        },
      });

      return res.status(201).json({
        id: newUser.id,
        utorid: newUser.utorid,
        name: newUser.name,
        email: newUser.email,
        verified: newUser.verified,
        defaultPassword: finalPassword, 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Database error" });
    }
  }
);

app.get(
  "/users",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    
    const filters = mergeFilterSources(req.query, req.body);
    const nameRaw = resolveFilterInput(filters, req, "name");
    const roleRaw = resolveFilterInput(filters, req, "role");
    const verifiedRaw = resolveFilterInput(filters, req, "verified");
    const activatedRaw = resolveFilterInput(filters, req, "activated");
    const pageRaw = resolveFilterInput(filters, req, "page");
    const limitRaw = resolveFilterInput(filters, req, "limit");
    const where = {};

    if (typeof nameRaw === "string" && nameRaw.trim()) {
      const term = nameRaw.trim();
      where.OR = [
        { name: { contains: term } },
        { utorid: { contains: term } },
      ];
    }

    if (roleRaw !== undefined) {
      const normalizedRole = normalizeRoleToken(roleRaw);
      if (!normalizedRole) {
        return res.status(400).json({ error: "role not valid" });
      }
      where.role = normalizedRole;
    }

    if (verifiedRaw !== undefined) {
      const parsedVerified = interpretBooleanFlag(verifiedRaw);
      if (parsedVerified === null) {
        return res.status(400).json({ error: "verified not valid" });
      }
      where.verified = parsedVerified;
    }

    if (activatedRaw !== undefined) {
      const parsedActivated = interpretBooleanFlag(activatedRaw);
      if (parsedActivated === null) {
        return res.status(400).json({ error: "activated not valid" });
      }
      where.lastLogin = parsedActivated ? { not: null } : null;
    }

    const pageNum =
      pageRaw === undefined || pageRaw === null
        ? 1
        : parsePositiveWhole(pageRaw);
    const limitNum =
      limitRaw === undefined || limitRaw === null
        ? 10
        : parsePositiveWhole(limitRaw);

    if (!pageNum) {
      return res.status(400).json({ error: "page not valid" });
    }
    if (!limitNum) {
      return res.status(400).json({ error: "limit not valid" });
    }

    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    try {
      const total = await prisma.user.count({ where });

      if (total > 0 && skip >= total) {
        return res.status(400).json({ error: "page/limit too large" });
      }

      const data = await prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { id: "asc" },
        select: {
          id: true,
          utorid: true,
          name: true,
          email: true,
          birthday: true,
          role: true,
          points: true,
          createdAt: true,
          lastLogin: true,
          verified: true,
          avatarUrl: true,
        },
      });

      const results = data.map((user) => ({
        ...user,
        birthday: formatIsoDateOnly(user.birthday),
        createdAt: formatIsoDateTime(user.createdAt),
        lastLogin: formatIsoDateTime(user.lastLogin),
      }));

      return res.status(200).json({
        count: total,
        results,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Database error" });
    }
  }
);

app.patch(
  "/users/me",
  requireAuthenticatedUser,
  enforceRoleClearance("regular"),
  async (req, res) => {
    
    const name = coalesceNullable(req.body.name);
    const email = coalesceNullable(req.body.email);
    const birthday = coalesceNullable(req.body.birthday);
    const avatarUrlInput = coalesceNullable(req.body.avatarUrl);
    const avatarInput = coalesceNullable(req.body.avatar);
    const data = {};
    const hasUpdates = [name, email, birthday, avatarUrlInput, avatarInput].some(
      (value) => value !== undefined
    );

    if (!hasUpdates) {
      return res.status(400).json({ error: "Payload empty" });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 50) {
        return res
          .status(400)
          .json({ error: "name must be between 1 and 50 characters" });
      }
      data.name = name.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeCampusEmail(email);
      if (!normalizedEmail) {
        return res.status(400).json({ error: "Email not proper format" });
      }
      data.email = normalizedEmail;
    }

    if (birthday !== undefined) {
      const normalizedBirthday = parseBirthdayIsoDate(birthday);
      if (!normalizedBirthday) {
        return res
          .status(400)
          .json({ error: "Birthday must be in YYYY-MM-DD format" });
      }

      data.birthday = normalizedBirthday;
    }

    const resolvedAvatar =
      avatarUrlInput !== undefined ? avatarUrlInput : avatarInput;
    if (resolvedAvatar !== undefined) {
      if (typeof resolvedAvatar !== "string" || !resolvedAvatar.trim()) {
        return res.status(400).json({ error: "avatar must be a valid string" });
      }
      data.avatarUrl = resolvedAvatar.trim();
    }

    try {
      const updated_user = await prisma.user.update({
        where: { id: req.user.id },
        data,
      });

      return res.status(200).json({
        id: updated_user.id,
        utorid: updated_user.utorid,
        name: updated_user.name,
        email: updated_user.email,
        birthday: formatIsoDateOnly(updated_user.birthday),
        role: updated_user.role,
        points: updated_user.points,
        createdAt: formatIsoDateTime(updated_user.createdAt),
        lastLogin: formatIsoDateTime(updated_user.lastLogin),
        verified: updated_user.verified,
        avatarUrl: updated_user.avatarUrl,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Database error" });
    }
  }
);

app.get(
  "/users/me",
  requireAuthenticatedUser,
  enforceRoleClearance("regular"),
  async (req, res) => {
    
    const user = req.user;
    const promotions = await collectAvailablePromotions(user.id);

    return res.status(200).json({
      id: user.id,
      utorid: user.utorid,
      name: user.name,
      email: user.email,
      birthday: formatIsoDateOnly(user.birthday),
      role: user.role,
      points: user.points,
      createdAt: formatIsoDateTime(user.createdAt),
      lastLogin: formatIsoDateTime(user.lastLogin),
      verified: user.verified,
      avatarUrl: user.avatarUrl,
      promotions,
    });
  }
);

app.patch(
  "/users/me/password",
  requireAuthenticatedUser,
  enforceRoleClearance("regular"),
  async (req, res) => {
    
    const oldPass = req.body.old;
    const newPass = req.body.new;

    if (
      typeof oldPass !== "string" ||
      !oldPass ||
      typeof newPass !== "string" ||
      !newPass
    ) {
      return res.status(400).json({ error: "Payload Empty" });
    }

    if (!validPassword(newPass)) {
      return res.status(400).json({ error: "New password wrong format" });
    }

    try {
      if (req.user.password !== oldPass) {
        return res.status(403).json({ error: "Old password is incorrect" });
      }

      const now = Date.now();
      const expires = new Date(req.user.expiresAt);

      if (expires < now) {
        return res.status(400).json({ error: "Token expired" });
      }

      const updated_user = await prisma.user.update({
        where: { id: req.user.id },
        data: { password: newPass },
      });

      return res.status(200).json({
        new_password: updated_user.password,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Database error" });
    }
  }
);

app.get("/users/:userId", requireAuthenticatedUser, enforceRoleClearance("cashier"), async (req, res) => {
  

  
  const clearance = String(req.user.role).toLowerCase();
  const high_clearance = clearance === "manager" || clearance === "superuser";
  const target_id = parseInt(req.params.userId, 10);

  if (isNaN(target_id)) {
    return res.status(400).json({ error: "?userId must be positive number" });
  }

  try {
    let data;

    if (high_clearance) {
      data = await prisma.user.findUnique({
        where: { id: target_id },
        select: {
          id: true,
          utorid: true,
          name: true,
          email: true,
          birthday: true,
          role: true,
          points: true,
          createdAt: true,
          lastLogin: true,
          verified: true,
          avatarUrl: true,
        },
      });
    } else {
      data = await prisma.user.findUnique({
        where: { id: target_id },
        select: {
          id: true,
          utorid: true,
          name: true,
          points: true,
          verified: true,
        },
      });
    }

    if (!data) {
      return res.status(404).json({ error: "User not found" });
    }

    const promotions = await collectAvailablePromotions(target_id);
    const response = {
      ...data,
      birthday: formatIsoDateOnly(data.birthday),
      createdAt: formatIsoDateTime(data.createdAt),
      lastLogin: formatIsoDateTime(data.lastLogin),
      promotions,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
});

app.patch(
  "/users/:userId",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    
    const target_id = parsePositiveWhole(req.params.userId);
    if (!target_id) {
      return res.status(400).json({ error: "?userId must be positive number" });
    }
    const email = coalesceNullable(req.body.email);
    const verified = coalesceNullable(req.body.verified);
    const suspicious = coalesceNullable(req.body.suspicious);
    const role = coalesceNullable(req.body.role);
    const name = coalesceNullable(req.body.name);
    const birthday = coalesceNullable(req.body.birthday);
    const data = {};
    const hasUpdates = [email, verified, suspicious, role, name, birthday].some(
      (value) => value !== undefined
    );

    if (!hasUpdates) {
      return res.status(400).json({ error: "Payload empty" });
    }

    try {
      const targetUser = await prisma.user.findUnique({
        where: { id: target_id },
      });

      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim() || name.trim().length > 50) {
          return res
            .status(400)
            .json({ error: "name must be between 1 and 50 characters" });
        }
        data.name = name.trim();
      }

      if (birthday !== undefined) {
        const parsedBirthday = parseBirthdayIsoDate(birthday);
        if (!parsedBirthday) {
          return res
            .status(400)
            .json({ error: "Birthday must be in YYYY-MM-DD format" });
        }
        data.birthday = parsedBirthday;
      }

      if (email !== undefined) {
        const normalizedEmail = normalizeCampusEmail(email);
        if (!normalizedEmail) {
          return res.status(400).json({ error: "Email not proper format" });
        }
        data.email = normalizedEmail;
      }

      if (verified !== undefined) {
        const parsedVerified = interpretBooleanFlag(verified);
        if (parsedVerified === null) {
          return res.status(400).json({ error: "verified not valid" });
        }
        if (parsedVerified !== true) {
          return res
            .status(400)
            .json({ error: "verified may only be set to true" });
        }
        data.verified = parsedVerified;
      }

      if (suspicious !== undefined) {
        const parsedSuspicious = interpretBooleanFlag(suspicious);
        if (parsedSuspicious === null) {
          return res.status(400).json({ error: "suspicious not valid" });
        }
        data.suspicious = parsedSuspicious;
      }

      if (role !== undefined) {
        const normalizedRole = normalizeRoleToken(role);
        if (!normalizedRole) {
          return res.status(400).json({ error: "role not valid" });
        }

        const requesterRole = req.user.role || "regular";
        const managerAssignable = ["regular", "cashier"];
        const canAssign =
          requesterRole === "superuser" ||
          (requesterRole === "manager" &&
            managerAssignable.includes(normalizedRole));

        if (!canAssign) {
          return res
            .status(403)
            .json({ error: "Not high enough clearance for that role" });
        }

        data.role = normalizedRole;
      }

      if (data.role === "cashier") {
        const updatedSuspicious =
          data.suspicious !== undefined
            ? data.suspicious
            : targetUser.suspicious;
        if (updatedSuspicious) {
          return res
            .status(400)
            .json({ error: "Cashiers cannot be marked suspicious" });
        }
      }

      const select = { id: true, utorid: true, name: true };
      Object.keys(data).forEach((key) => {
        select[key] = true;
      });

      const updated_user = await prisma.user.update({
        where: { id: target_id },
        data,
        select,
      });

      return res.status(200).json(updated_user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Database error" });
    }
  }
);

app.post("/auth/tokens", async (req, res) => {
  
  const { utorid, password } = req.body;

  if (!utorid || !password) {
    return res.status(400).json({ error: "Utorid or password missing" });
  }

  const jwt = issueToken(utorid, "7d");
  let curr_time = new Date().toISOString();
  let week_later = new Date();
  week_later.setDate(week_later.getDate() + 7);
  week_later = week_later.toISOString();

  try {
    const existing = await prisma.user.findUnique({
      where: { utorid },
    });

    if (!existing) {
      return res
        .status(401)
        .json({
          message: "User with provided utorid and password does not exist.",
        });
    } else if (existing && existing.password !== password) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    let data = {};
    data.token = jwt;
    data.createdAt = curr_time;
    data.lastLogin = curr_time;
    data.expiresAt = week_later;

    const updated_user = await prisma.user.update({
      where: {
        utorid: utorid,
      },
      data,
      select: {
        token: true,
        expiresAt: true,
      },
    });

    return res.status(200).json(updated_user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
});

app.post("/auth/resets", async (req, res) => {
  
  const { utorid } = req.body;

  const cleanUtorid =
    typeof utorid === "string" ? utorid.trim() : "";
  const normalizedUtorid = cleanUtorid.toLowerCase();

  if (!normalizedUtorid) {
    return res.status(400).json({ message: "Empty payload" });
  }

  const ip = req.ip || "unknown";
  const now = Date.now();

  if (!resetRequestBudget[ip]) {
    resetRequestBudget[ip] = {};
  }

  for (const [storedUtorid, timestamp] of Object.entries(resetRequestBudget[ip])) {
    if (now - timestamp > 60000) {
      delete resetRequestBudget[ip][storedUtorid];
    }
  }

  if (
    resetRequestBudget[ip][normalizedUtorid] &&
    now - resetRequestBudget[ip][normalizedUtorid] < 60000
  ) {
    return res.status(429).json({ message: "Too many requests" });
  }

  resetRequestBudget[ip][normalizedUtorid] = now;

  try {
    const existing = await prisma.user.findUnique({
      where: { utorid: cleanUtorid },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ message: "A user with that utorid does not exist" });
    }

    const resetToken = uuidv4();

    const hour_later = new Date();
    hour_later.setHours(hour_later.getHours() + 1);

    const updated_user = await prisma.user.update({
      where: { utorid: cleanUtorid },
      data: {
        token: resetToken,
        expiresAt: hour_later.toISOString(),
      },
    });

    return res.status(202).json({
      expiresAt: updated_user.expiresAt,
      resetToken: updated_user.token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
});

app.post("/auth/resets/:resetToken", async (req, res) => {
  
  const resetToken = req.params.resetToken;
  const { utorid, password } = req.body;

  const normalizedUtorid =
    typeof utorid === "string" ? utorid.trim().toLowerCase() : "";

  if (!resetToken || !normalizedUtorid || !password) {
    return res
      .status(400)
      .json({ error: "Must provide a reset token, utorid, and password" });
  }

  if (!validPassword(password)) {
    return res.status(400).json({ error: "password given was incorrect" });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { token: resetToken },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ message: "A user with that token does not exist" });
    }

    if (
      existing.expiresAt &&
      new Date(existing.expiresAt).getTime() < Date.now()
    ) {
      return res.status(410).json({ message: "Token has expired" });
    }

    if (existing.utorid.toLowerCase() !== normalizedUtorid) {
      return res.status(401).json({ message: "Utorid token pairing wrong" });
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password,
        verified: true,
        token: null,
        expiresAt: null,
      },
    });

    return res.status(200).json({ success: "password created" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Database error" });
  }
});

app.post("/transactions", requireAuthenticatedUser, async (req, res) => {
  

  const { utorid, type, spent, amount, relatedId, remark = "" } = req.body;
  const createdBy = req.user.utorid;
  const userRole = req.user.role.toUpperCase();

  const promotionIds =
    typeof req.body.promotionIds === "string"
      ? req.body.promotionIds.split(",").map(Number)
      : Array.isArray(req.body.promotionIds)
      ? req.body.promotionIds
      : [];

  try {
    if (type !== "purchase" && type !== "adjustment") {
      return res
        .status(400)
        .json({ error: 'type must be "purchase" or "adjustment"' });
    }

    if (
      type === "purchase" &&
      !["CASHIER", "MANAGER", "SUPERUSER"].includes(userRole)
    ) {
      return res
        .status(403)
        .json({ error: "insufficient clearance for purchase transactions" });
    }
    if (type === "adjustment" && !["MANAGER", "SUPERUSER"].includes(userRole)) {
      return res
        .status(403)
        .json({ error: "insufficient clearance for adjustment transactions" });
    }

    const user = await prisma.user.findUnique({ where: { utorid } });
    if (!user) return res.status(400).json({ error: "user not found" });

    const promotions = [];
    const now = new Date();
    for (const promotionId of promotionIds) {
      const promotion = await prisma.promotion.findUnique({
        where: { id: promotionId },
      });
      if (!promotion)
        return res
          .status(400)
          .json({ error: `promotion ${promotionId} not found` });

      if (
        promotion.startTime > now ||
        promotion.endTime < now
      ) {
        return res
          .status(400)
          .json({ error: `promotion ${promotionId} is not active` });
      }
      if (
        promotion.minSpending !== null &&
        promotion.minSpending !== undefined &&
        typeof spent === "number" &&
        spent < promotion.minSpending
      ) {
        return res
          .status(400)
          .json({ error: `promotion ${promotionId} does not meet min spending` });
      }

      const usage = await prisma.usage.findFirst({
        where: { userId: user.id, promotionId: promotion.id },
      });
      if (usage)
        return res
          .status(400)
          .json({ error: `promotion ${promotionId} already used` });

      promotions.push(promotion);
    }

    let transaction;

    if (type === "purchase") {
      if (typeof spent !== "number" || spent <= 0) {
        return res
          .status(400)
          .json({ error: "spent must be a positive number" });
      }

      let earnedPoints = Math.round(spent / 0.25);
      for (const promotion of promotions) {
        earnedPoints += derivePromotionBonus(promotion, spent);
      }

      transaction = await prisma.transaction.create({
        data: {
          utorid,
          type,
          spent,
          amount: earnedPoints,
          remark,
          createdBy,
          suspicious: req.user.suspicious,
          promotions: { connect: promotions.map((p) => ({ id: p.id })) },
        },
        include: { promotions: true },
      });

      if (!req.user.suspicious) {
        await prisma.user.update({
          where: { id: user.id },
          data: { points: user.points + earnedPoints },
        });
      }
    } else if (type === "adjustment") {
      if (typeof amount !== "number") {
        return res.status(400).json({ error: "amount must be a number" });
      }

      const relatedTransaction = await prisma.transaction.findUnique({
        where: { id: parseInt(relatedId) },
      });

      if (!relatedTransaction) {
        return res.status(404).json({ error: "related transaction not found" });
      }

      transaction = await prisma.transaction.create({
        data: {
          utorid,
          type,
          amount,
          relatedId: parseInt(relatedId),
          spent: 0,
          earned: 0,
          remark,
          createdBy,
          promotions: {
            connect: promotions.map((promotion) => ({ id: promotion.id })),
          },
        },
        include: { promotions: true },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { points: user.points + amount },
      });
    }

    for (const promotion of promotions) {
      if (promotion.isOneTime) {
        await prisma.usage.create({
          data: { userId: user.id, promotionId: promotion.id },
        });
      }
    }
    const response = {
      id: transaction.id,
      utorid: transaction.utorid,
      type: transaction.type,
      remark: transaction.remark,
      promotionIds: (transaction.promotions || []).map((p) => p.id),
      createdBy: transaction.createdBy,
    };

    if (type === "purchase") {
      response.spent = transaction.spent;

      if (req.user.suspicious) {
        response.earned = 0;
      } else {
        response.earned = transaction.amount;
      }
    } else {
      response.amount = transaction.amount;
      response.relatedId = transaction.relatedId;
    }

    res.status(201).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to create transaction" });
  }
});

app.get(
  "/transactions",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    

    const {
      name,
      createdBy,
      suspicious,
      promotionId,
      type,
      relatedId,
      amount,
      operator,
      page = 1,
      limit = 10,
    } = req.query;
    try {
      const filters = {};

      if (name) {
        filters.utorid = { contains: name.toLowerCase() };
      }

      if (createdBy) {
        filters.createdBy = createdBy;
      }

      if (suspicious !== null && suspicious !== undefined) {
        filters.suspicious = suspicious === "true";
      }

      if (promotionId && promotionId !== undefined) {
        filters.promotions = { some: { id: parseInt(promotionId) } };
      }

      if (type && type !== undefined) {
        filters.type = type;
      }

      if (relatedId && relatedId !== undefined) {
        if (!type) {
          return res
            .status(400)
            .json({ error: "relatedId must be used with type" });
        }
        filters.relatedId = parseInt(relatedId);
      }

      if (amount !== null && amount !== undefined) {
        if (!operator || !["gte", "lte"].includes(operator)) {
          return res
            .status(400)
            .json({
              error: 'operator must be "gte" or "lte" when filtering by amount',
            });
        }
        filters.amount = { [operator]: parseFloat(amount) };
      }

      const count = await prisma.transaction.count({ where: filters });

      const transactions = await prisma.transaction.findMany({
        where: filters,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        include: {
          promotions: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const results = transactions.map((transaction) =>
        composeTransactionResponse(transaction, {
          includeSuspicious: true,
          includeCreatedAt: true,
          includeName: false,
        })
      );

      res.status(200).json({
        count,
        results,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "failed to retrieve transactions" });
    }
  }
);

app.patch(
  "/transactions/:transactionId/suspicious",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    
    const { transactionId } = req.params;
    const { suspicious } = req.body;

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: parseInt(transactionId) },
        include: {
          promotions: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!transaction) {
        return res.status(404).json({ error: "transaction not found" });
      }

      const user = await prisma.user.findUnique({
        where: { utorid: transaction.utorid },
      });

      if (!user) {
        return res.status(404).json({ error: "user not found" });
      }

      let newPoints = user.points;
      if (suspicious && !transaction.suspicious) {
        newPoints = Math.max(0, user.points - transaction.amount);
      } else if (!suspicious && transaction.suspicious) {
        newPoints = user.points + transaction.amount;
      }

      const [updatedTransaction] = await prisma.$transaction([
        prisma.transaction.update({
          where: { id: parseInt(transactionId) },
          data: {
            suspicious,
          },
          include: {
            promotions: {
              select: { id: true },
            },
          },
        }),
        prisma.user.update({
          where: { utorid: transaction.utorid },
          data: { points: Math.round(newPoints) },
        }),
      ]);

      const response = {
        id: updatedTransaction.id,
        utorid: updatedTransaction.utorid,
        type: updatedTransaction.type,
        spent: updatedTransaction.spent,
        amount: updatedTransaction.amount,
        promotionIds: updatedTransaction.promotions.map(
          (promotion) => promotion.id
        ),
        suspicious: updatedTransaction.suspicious,
        remark: updatedTransaction.remark,
        createdBy: updatedTransaction.createdBy,
      };

      res.status(200).json(response);
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ error: "failed to update transaction suspicious flag" });
    }
  }
);

app.get(
  "/transactions/:transactionId",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    
    const { transactionId } = req.params;
    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: parseInt(transactionId) },
        include: {
          promotions: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!transaction) {
        return res.status(404).json({ error: "transaction not found" });
      }

      res
        .status(200)
        .json(
          composeTransactionResponse(transaction, {
            includeSuspicious: true,
          })
        );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "failed to retrieve transaction" });
    }
  }
);

app.post(
  "/transactions/transfer",
  requireAuthenticatedUser,
  enforceRoleClearance("regular"),
  async (req, res) => {
    // 1. Accept 'targetUtorid' (String) instead of 'userId' (Int)
    const { targetUtorid, amount, remark } = req.body;

    const numericAmount = parsePositiveWholeegerStrict(amount);
    if (!numericAmount) {
      return res.status(400).json({ error: "amount must be a positive integer" });
    }

    if (!targetUtorid || typeof targetUtorid !== "string") {
        return res.status(400).json({ error: "targetUtorid is required" });
    }

    try {
      const sender = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!sender) return res.status(401).json({ error: "Unauthorized" });
      if (!sender.verified) return res.status(403).json({ error: "Sender must be verified" });

      // 2. Find the recipient by their UtorID
      const recipient = await prisma.user.findUnique({
        where: { utorid: targetUtorid },
      });

      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      if (recipient.id === sender.id) {
        return res.status(400).json({ error: "Cannot transfer points to yourself" });
      }

      if (sender.points < numericAmount) {
        return res.status(400).json({ error: "Insufficient points for transfer" });
      }

      const resolvedRemark = remark || "";

      // 3. Perform the transfer
      const transferResult = await prisma.$transaction(async (tx) => {
        const freshSender = await tx.user.findUnique({ where: { id: sender.id } });
        
        if (freshSender.points < numericAmount) {
          throw new Error("transfer_insufficient");
        }

        // Sender Transaction (Negative)
        const senderTx = await tx.transaction.create({
          data: {
            utorid: sender.utorid,
            type: "transfer",
            amount: -numericAmount,
            relatedId: recipient.id,
            remark: resolvedRemark,
            createdBy: sender.utorid,
          },
        });

        // Recipient Transaction (Positive)
        await tx.transaction.create({
          data: {
            utorid: recipient.utorid,
            type: "transfer",
            amount: numericAmount,
            relatedId: sender.id,
            remark: resolvedRemark,
            createdBy: sender.utorid,
          },
        });

        // Update Points
        await tx.user.update({
          where: { id: sender.id },
          data: { points: { decrement: numericAmount } },
        });

        await tx.user.update({
          where: { id: recipient.id },
          data: { points: { increment: numericAmount } },
        });

        return senderTx;
      });

      return res.status(201).json({
        id: transferResult.id,
        sender: sender.utorid,
        recipient: recipient.utorid,
        amount: numericAmount,
        remark: resolvedRemark,
      });

    } catch (error) {
      if (error?.message === "transfer_insufficient") {
        return res.status(400).json({ error: "Insufficient points for transfer" });
      }
      console.error(error);
      res.status(500).json({ error: "Failed to create transfer" });
    }
  }
);

app.post(
  "/users/me/transactions",
  requireAuthenticatedUser,
  enforceRoleClearance("regular"),
  async (req, res) => {
    const { type, amount, remark } = req.body;
    const normalizedType =
      typeof type === "string" ? type.trim().toLowerCase() : "";
    if (normalizedType !== "redemption") {
      return res.status(400).json({ error: 'type must be "redemption"' });
    }

    const numericAmount = parsePositiveWholeegerStrict(amount);
    if (!numericAmount) {
      return res
        .status(400)
        .json({ error: "amount must be a positive integer" });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!user.verified) {
        return res.status(403).json({ error: "User must be verified" });
      }

      if (numericAmount > user.points) {
        return res
          .status(400)
          .json({ error: "Requested amount exceeds balance" });
      }

      const resolvedRemark =
        remark === undefined || remark === null ? "" : String(remark);

      const transaction = await prisma.transaction.create({
        data: {
          utorid: user.utorid,
          type: "redemption",
          amount: numericAmount,
          remark: resolvedRemark,
          createdBy: user.utorid,
          processed: false,
          processedBy: null,
        },
      });

      return res.status(201).json({
        id: transaction.id,
        utorid: transaction.utorid,
        type: transaction.type,
        processedBy: transaction.processedBy,
        amount: transaction.amount,
        remark: transaction.remark,
        createdBy: transaction.createdBy,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create redemption" });
    }
  }
);

app.get(
  "/users/me/transactions",
  requireAuthenticatedUser,
  enforceRoleClearance("regular"),
  async (req, res) => {
    const {
      type,
      relatedId,
      promotionId,
      amount,
      operator,
      page = 1,
      limit = 10,
    } = req.query;

    const where = {
      utorid: req.user.utorid,
    };

    if (type) {
      where.type = type;
    }

    if (relatedId !== undefined && relatedId !== null) {
      if (!type) {
        return res
          .status(400)
          .json({ error: "relatedId filter must be used with type" });
      }
      const numericRelatedId = parseInt(relatedId, 10);
      if (Number.isNaN(numericRelatedId)) {
        return res.status(400).json({ error: "relatedId not valid" });
      }
      where.relatedId = numericRelatedId;
    }

    if (promotionId !== undefined && promotionId !== null) {
      const numericPromotionId = parseInt(promotionId, 10);
      if (Number.isNaN(numericPromotionId)) {
        return res.status(400).json({ error: "promotionId not valid" });
      }
      where.promotions = { some: { id: numericPromotionId } };
    }

    if (amount !== undefined && amount !== null) {
      if (!operator || !["gte", "lte"].includes(operator)) {
        return res
          .status(400)
          .json({
            error: 'operator must be "gte" or "lte" when filtering by amount',
          });
      }
      where.amount = { [operator]: parseFloat(amount) };
    }

    const pageNum =
      page === undefined || page === null ? 1 : parsePositiveWhole(page);
    const limitNum =
      limit === undefined || limit === null ? 10 : parsePositiveWhole(limit);

    if (!pageNum) {
      return res.status(400).json({ error: "page not valid" });
    }
    if (!limitNum) {
      return res.status(400).json({ error: "limit not valid" });
    }

    try {
      const count = await prisma.transaction.count({ where });

      const transactions = await prisma.transaction.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: {
          promotions: {
            select: { id: true },
          },
        },
      });

      const results = transactions.map((transaction) =>
        composeTransactionResponse(transaction, {
          includeSuspicious: false,
          includeCreatedAt: true,
        })
      );

      res.status(200).json({ count, results });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  }
);

app.patch(
  "/transactions/:transactionId/processed",
  requireAuthenticatedUser,
  enforceRoleClearance("cashier"),
  async (req, res) => {
    const transactionId = parsePositiveWhole(req.params.transactionId);
    if (!transactionId) {
      return res.status(404).json({ error: "transaction not found" });
    }

    const parsedProcessed = interpretBooleanFlag(req.body?.processed);
    if (parsedProcessed !== true) {
      return res
        .status(400)
        .json({ error: "processed must be set to true" });
    }

    try {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        return res.status(404).json({ error: "transaction not found" });
      }

      if (transaction.type.toLowerCase() !== "redemption") {
        return res
          .status(400)
          .json({ error: "Only redemption transactions can be processed" });
      }

      if (transaction.processed) {
        return res.status(400).json({ error: "Transaction already processed" });
      }

      const user = await prisma.user.findUnique({
        where: { utorid: transaction.utorid },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.points < transaction.amount) {
        return res
          .status(400)
          .json({ error: "User no longer has sufficient points" });
      }

      const [, updatedTransaction] = await prisma.$transaction([
        prisma.user.update({
          where: { id: user.id },
          data: { points: { decrement: transaction.amount } },
        }),
        prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            processed: true,
            processedBy: req.user.utorid,
          },
        }),
      ]);

      res.status(200).json({
        id: updatedTransaction.id,
        utorid: updatedTransaction.utorid,
        type: updatedTransaction.type,
        processedBy: updatedTransaction.processedBy,
        amount: updatedTransaction.amount,
        redeemed: updatedTransaction.amount,
        remark: updatedTransaction.remark,
        createdBy: updatedTransaction.createdBy,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process redemption" });
    }
  }
);


app.get("/events", requireAuthenticatedUser, async (req, res) => {
  const currentUser = req.user;
  const roleLower = (currentUser.role || "").toLowerCase();

  const {
    name,
    location,
    started,
    ended,
    showFull,
    page: qpage,
    limit,
    published,
  } = req.query;

  let where = {};
  let pageNum = 1;
  let take = 10;
  if (name !== undefined) {
    where.name = name;
  }
  if (location !== undefined) {
    where.location = location;
  }

  if (started !== undefined) {
    const parsedStarted = interpretBooleanFlag(started);
    if (parsedStarted === null) {
      return res.status(400).json({ error: "Invalid type for started" });
    }
    where.startTime = parsedStarted ? { lt: new Date() } : { gt: new Date() };
  }
  if (ended !== undefined) {
    const parsedEnded = interpretBooleanFlag(ended);
    if (parsedEnded === null) {
      return res.status(400).json({ error: "Invalid type for ended" });
    }
    where.endTime = parsedEnded ? { lt: new Date() } : { gt: new Date() };
  }

  if (qpage !== undefined) {
    const parsed = parsePositiveWhole(qpage);
    if (!parsed) {
      return res.status(400).json({ error: "Invalid type for page" });
    }
    pageNum = parsed;
  }

  if (limit !== undefined) {
    const parsedLimit = parsePositiveWhole(limit);
    if (!parsedLimit) {
      return res.status(400).json({ error: "Invalid type for limit" });
    }

    take = parsedLimit;
  }

  const skip = (pageNum - 1) * take;

  if (started === "true" && ended === "true") {
    return res
      .status(400)
      .json({
        error:
          "Start time and end time are listed. Only one should be provided.",
      }); //passed
  }

  if (published !== undefined) {
    if (published === "false") {
      if (roleLower === "manager" || roleLower === "superuser") {
        where.published = false;
      } else {
        return res
          .status(403)
          .json({
            error: "Only managers or higher, can view published events",
          });
      } //passed
    } else {
      where.published = true;
    }
  } else if (published === undefined) {
    if (roleLower !== "manager" && roleLower !== "superuser") {
      where.published = true; //passed
    }
  }

  const events = await prisma.event.findMany({
    where,
    include: { guests: true },
  });

  let filtered = events;

  if (showFull !== undefined) {
    const parsedShowFull = interpretBooleanFlag(showFull);
    if (parsedShowFull === null) {
      return res.status(400).json({ error: "Invalid type for showFull" });
    }
    if (!parsedShowFull) {
      filtered = events.filter((event) => !hasEventReachedCapacity(event));
    }
  } else {
    filtered = events.filter((event) => !hasEventReachedCapacity(event));
  }

  const resultRegular = filtered
    .map((event) => {
      const {
        description,
        organizers,
        guests,
        published,
        pointsRemain,
        pointsAwarded,
        ...rest
      } = event;
      return { ...rest, numGuests: guests.length };
    })
    .slice(skip, take + skip);

  const resultHigher = filtered
    .map((event) => {
      const { description, organizers, guests, ...rest } = event;
      return { ...rest, numGuests: guests.length };
    })
    .slice(skip, take + skip);

  if (roleLower === "manager" || roleLower === "superuser") {
    return res
      .status(200)
      .json({ count: filtered.length, results: resultHigher });
  } else {
    return res
      .status(200)
      .json({ count: filtered.length, results: resultRegular });
  }
});

app.post(
  "/events",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {

    const currentUser = req.user;


    const {
      name,
      description,
      location,
      startTime,
      endTime,
      capacity,
      points,
    } = req.body;

    if (
      name === undefined &&
      description === undefined &&
      location === undefined &&
      startTime === undefined &&
      endTime === undefined &&
      capacity === undefined &&
      points === undefined
    ) {
      return res.status(400).json({ error: "Empty payload" }); //passed
    } else if (
      name === undefined ||
      description === undefined ||
      location === undefined ||
      startTime === undefined ||
      endTime === undefined ||
      points === undefined
    ) {
      return res.status(400).json({ error: "Invalid payload" }); //passed
    } else {
      let dateobj = new Date(startTime);
      let dateobj2 = new Date(endTime);
      if (
        isNaN(dateobj.getTime()) ||
        isNaN(dateobj2.getTime()) ||
        dateobj > dateobj2
      ) {
        return res.status(400).json({ error: "Invalid date format" }); //passed
      }

      if (capacity !== undefined && capacity < 0) {
        return res.status(400).json({ error: "Capacity cannot be negative" }); //passed
      }

      if (points < 0) {
        return res.status(400).json({ error: "Points cannot be negative" }); //passed
      }

      const newEvent = await prisma.event.create({
        data: {
          name: name,
          description: description,
          location: location,
          startTime: startTime,
          endTime: endTime,
          capacity: capacity,
          pointsRemain: points,
          pointsAwarded: 0,
          published: false,
        },
        include: {
          organizers: true,
          guests: true,
        },
      });
      return res.status(201).json(newEvent);
    }
  }
);

app.get("/events/:eventId", requireAuthenticatedUser, async (req, res) => {
  const currentUser = req.user;

  const payload = await fetchEventOrError(req, res, { organizers: true, guests: true });
  if (!payload) {
    return;
  }
  const { event } = payload;

  const alreadyOrganizer = event.organizers.some(
    (org) => org.id === currentUser.id
  );

  if (!event.published && !(alreadyOrganizer || currentUser.role !== "regular")) {
    return res.status(404).json({ error: "Event not found" });
  }

  if (currentUser.role === "regular" && !alreadyOrganizer) {
    const { guests, ...rest } = event;
    return res.status(200).json({ ...rest, numGuests: guests.length });
  }

  return res.status(200).json(event);
});

app.patch("/events/:eventId", requireAuthenticatedUser, async (req, res) => {
  const currentUser = req.user;
  if (!currentUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const payload = await fetchEventOrError(req, res, {
    organizers: true,
    guests: true,
  });
  if (!payload) {
    return;
  }
  const { eventId: eid, event } = payload;

  const isOrganizer = event.organizers.some(
    (org) => org.id === currentUser.id
  );
  const requesterRole = (currentUser.role || "").toLowerCase();

  if (
    !isOrganizer &&
    requesterRole !== "manager" &&
    requesterRole !== "superuser"
  ) {
    return res
      .status(403)
      .json({
        error: "Only managers or higher, or event organizers can update events",
      });
  }

  const sanitizeOptionalInput = (value) =>
    value === undefined || value === null ? undefined : value;
  const hasCapacityField = Object.prototype.hasOwnProperty.call(
    req.body,
    "capacity"
  );
  const name = sanitizeOptionalInput(req.body.name);
  const description = sanitizeOptionalInput(req.body.description);
  const location = sanitizeOptionalInput(req.body.location);
  const startTimeValue = sanitizeOptionalInput(req.body.startTime);
  const endTimeValue = sanitizeOptionalInput(req.body.endTime);
  const pointsInput = sanitizeOptionalInput(req.body.points);
  const publishedInput =
    req.body.published === undefined || req.body.published === null
      ? undefined
      : req.body.published;
  const capacityProvided =
    hasCapacityField &&
    req.body.capacity !== undefined &&
    req.body.capacity !== null;
  const rawCapacity = capacityProvided ? req.body.capacity : undefined;

  const currentDate = new Date();

  if (startTimeValue !== undefined) {
    const parsedStart = new Date(startTimeValue);
    if (!Number.isNaN(parsedStart.getTime())) {
      if (parsedStart < currentDate) {
        return res
          .status(400)
          .json({ error: "Event times cannot be in the past" });
      }
    } else {
      return res.status(400).json({ error: "invalid payload" });
    }
  }
  if (currentDate > new Date(event.startTime)) {
    if (
      name !== undefined ||
      description !== undefined ||
      location !== undefined ||
      startTimeValue !== undefined ||
      capacityProvided
    ) {
      return res
        .status(400)
        .json({
          error:
            "Cannot update name, description, location, start time, or capacity of an event that has already started",
        });
    }
  }

  if (endTimeValue !== undefined) {
    const parsedEnd = new Date(endTimeValue);
    if (!Number.isNaN(parsedEnd.getTime())) {
      if (
        parsedEnd < currentDate ||
        parsedEnd < new Date(event.startTime) ||
        (new Date(event.endTime) < currentDate &&
          currentDate < parsedEnd)
      ) {
        return res
          .status(400)
          .json({ error: "Event times cannot be in the past" });
      }
    } else {
      return res.status(400).json({ error: "invalid payload" });
    }
  }

  let normalizedCapacity;
  if (capacityProvided) {
    normalizedCapacity = Number(rawCapacity);
    if (!Number.isFinite(normalizedCapacity) || normalizedCapacity < 0) {
      return res.status(400).json({ error: "Event capacity not valid" });
    }
    if (event.guests.length > normalizedCapacity) {
      return res.status(400).json({ error: "Event capacity not valid" });
    }
  }

  let normalizedPoints;
  let recalculatedRemain;
  if (pointsInput !== undefined) {
    normalizedPoints = Number(pointsInput);
    if (!Number.isFinite(normalizedPoints) || normalizedPoints < 0) {
      return res.status(400).json({ error: "Points not valid" });
    }
    if (requesterRole !== "manager") {
      return res
        .status(403)
        .json({ error: "Only managers can update event points" });
    } else if (normalizedPoints < event.pointsAwarded) {
      return res.status(400).json({ error: "Points not valid" });
    }
    recalculatedRemain = normalizedPoints - event.pointsAwarded;
  }
  if (publishedInput !== undefined) {
    if (publishedInput !== true) {
      return res.status(400).json({ error: "Invalid publish value" });
    }
    if (requesterRole !== "manager") {
      return res
        .status(403)
        .json({ error: "Only managers can publish events" });
    }
  }

  const dataToUpdate = {};
  if (name !== undefined) {
    if (event.name !== name) {
      dataToUpdate.name = name;
    }
  }
  if (description !== undefined) {
    if (event.description !== description) {
      dataToUpdate.description = description;
    }
  }
  if (location !== undefined) {
    if (event.location !== location) {
      dataToUpdate.location = location;
    }
  }
  if (startTimeValue !== undefined) {
    if (
      new Date(event.startTime).getTime() !==
      new Date(startTimeValue).getTime()
    ) {
      dataToUpdate.startTime = startTimeValue;
    }
  }
  if (endTimeValue !== undefined) {
    if (
      new Date(event.endTime).getTime() !== new Date(endTimeValue).getTime()
    ) {
      dataToUpdate.endTime = endTimeValue;
    }
  }
  if (capacityProvided && normalizedCapacity !== undefined) {
    if (event.capacity !== normalizedCapacity) {
      dataToUpdate.capacity = normalizedCapacity;
    }
  }
  if (recalculatedRemain !== undefined) {
    if (event.pointsRemain !== recalculatedRemain) {
      dataToUpdate.pointsRemain = recalculatedRemain;
    }
  }
  if (publishedInput !== undefined) {
    if (!event.published) {
      dataToUpdate.published = true;
    }
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eid },
    data: dataToUpdate,
  });

  let resultEvent = {
    id: updatedEvent.id,
    name: updatedEvent.name,
    location: updatedEvent.location,
  };

  Object.keys(dataToUpdate).forEach((key) => {
    if (!["name", "location"].includes(key)) {
      resultEvent[key] = dataToUpdate[key];
      if (key === "pointsRemain") {
        resultEvent["pointsAwarded"] = updatedEvent.pointsAwarded;
      }
    }
  });

  res.status(200).json(resultEvent);
});

app.delete(
  "/events/:eventId",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    const currentUser = req.user;

    const payload = await fetchEventOrError(req, res);
    if (!payload) {
      return;
    }
    const { eventId: eid, event } = payload;

    if (event.published) {
      return res.status(400).json({ error: "Cannot delete a published event" });
    }

    await prisma.event.delete({
      where: { id: eid },
    });
    return res.status(204).send();
  }
);

app.post(
  "/events/:eventId/organizers",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { utorid } = req.body;
    if (utorid === undefined) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const user = await prisma.user.findUnique({
      where: { utorid },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const payload = await fetchEventOrError(req, res, {
      guests: true,
      organizers: true,
    });
    if (!payload) {
      return;
    }
    const { eventId: eid, event } = payload;

    if (event.endTime < new Date()) {
      return res
        .status(410)
        .json({ error: "Cannot add organizers to an event that has ended" });
    } else if (event.guests.some((guest) => guest.id === user.id)) {
      return res
        .status(400)
        .json({ error: "User is already a guest of the event" });
    } else {
      const alreadyOrganizer = event.organizers.some(
        (org) => org.id === user.id
      );

      if (!alreadyOrganizer) {
        const updatedEvent = await prisma.event.update({
          where: { id: eid },
          data: {
            organizers: { connect: { id: user.id } },
          },
          include: { organizers: true },
        });

        const result = [];
        updatedEvent.organizers.forEach((org) => {
          const { id, utorid, name, ...rest } = org;
          result.push({ id, utorid, name });
        });
        return res
          .status(201)
          .json({
            id: event.id,
            name: event.name,
            location: event.location,
            organizers: result,
          });
      } else {
        return res
          .status(400)
          .json({ error: "User is already an organizer for this event" });
      }
    }
  }
);

app.delete(
  "/events/:eventId/organizers/:userId",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    const currentUser = req.user;

    const uid = parsePositiveWhole(req.params.userId);
    if (!uid) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const payload = await fetchEventOrError(req, res, { organizers: true });
    if (!payload) {
      return;
    }
    const { eventId: eid, event } = payload;

    const validOrganizer = event.organizers.filter((org) => {
      return org.id === user.id;
    });

    if (validOrganizer.length !== 0) {
      const deleteUser = validOrganizer[0].id;
      const updatedEvent = await prisma.event.update({
        where: { id: eid },
        data: {
          organizers: {
            disconnect: { id: deleteUser },
          },
        },
      });
      return res.status(204).send();
    }
    return res
      .status(404)
      .json({ error: "User is not an organizer of this event" });
  }
);

app.post("/events/:eventId/guests/me", requireAuthenticatedUser, async (req, res) => {
  const payload = await fetchEventOrError(req, res, { guests: true });
  if (!payload) {
    return;
  }
  const { eventId: eid, event } = payload;

  const user = req.user;
  const isGuest = event.guests.some((guest) => guest.id === user.id);
  const eventIsFull = hasEventReachedCapacity(event);
  const dbReportsFull = eventIsFull || (await fetchEventCapacitySnapshot(eid));

  if (isGuest) {
    return res
      .status(400)
      .json({ error: "User is already a guest of the event" });
  } else if (
    dbReportsFull ||
    event.endTime < new Date()
  ) {
    return res.status(410).json({ error: "Event is full or has ended" });
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eid },
    data: {
      guests: {
        connect: { id: user.id },
      },
    },
    include: { guests: true },
  });

  const { id, utorid, name, ...rest } = user;

  return res.status(201).json({
    id: event.id,
    name: event.name,
    location: event.location,
    guestAdded: { id, utorid, name },
    numGuests: updatedEvent.guests.length,
  });
});

app.delete("/events/:eventId/guests/me", requireAuthenticatedUser, async (req, res) => {
  const payload = await fetchEventOrError(req, res, { guests: true });
  if (!payload) {
    return;
  }
  const { eventId: eid, event } = payload;

  const user = req.user;
  const isGuest = event.guests.some((guest) => guest.id === user.id);

  if (event.endTime < new Date()) {
    return res
      .status(410)
      .json({ error: "Cannot remove guests from an event that has ended" });
  }

  if (!isGuest) {
    return res
      .status(404)
      .json({ error: "User is not a guest of the event" });
  }

  await prisma.event.update({
    where: { id: eid },
    data: {
      guests: {
        disconnect: { id: user.id },
      },
    },
  });
  return res.status(204).send();
});

app.post("/events/:eventId/guests", requireAuthenticatedUser, async (req, res) => {
  const currentUser = req.user;
  if (!currentUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const requesterRole = (currentUser.role || "").toLowerCase();

  const payload = await fetchEventOrError(req, res, {
    organizers: true,
    guests: true,
  });
  if (!payload) {
    return;
  }
  const { eventId: eid, event } = payload;

  const currentUserAlready = event.organizers.filter((org) => {
    return org.id === currentUser.id;
  });

  if (
    currentUserAlready.length === 0 &&
    requesterRole !== "manager" &&
    requesterRole !== "superuser"
  ) {
    return res
      .status(403)
      .json({
        error: "Only managers or higher, or event organizers can update events",
      });
  }

  const { utorid } = req.body;
  const user = await prisma.user.findUnique({
    where: { utorid: utorid },
  });

  const alreadyOrganizer = event.organizers.filter((org) => {
    return org.id === user.id;
  });

  const alreadyGuest = event.guests.filter((guest) => {
    return guest.id === user.id;
  });
  const eventIsFull = hasEventReachedCapacity(event);
  const dbReportsFull = eventIsFull || (await fetchEventCapacitySnapshot(eid));

  if (alreadyOrganizer.length !== 0) {
    return res
      .status(400)
      .json({ error: "User is already an organizer of the event" });
  } else if (alreadyGuest.length !== 0) {
    return res
      .status(409)
      .json({ error: "User is already a guest of this event" });
  } else if (!event.published) {
    return res.status(404).json({ error: "Event is not published yet" });
  } else if (
    dbReportsFull ||
    event.endTime < new Date()
  ) {
    return res.status(410).json({ error: "Event is full or has ended" });
  } else {
    const updatedEvent = await prisma.event.update({
      where: { id: eid },
      data: {
        guests: { connect: { id: user.id } },
      },
      include: { guests: true },
    });

    const { id, utorid, name, ...rest } = user;

    return res.status(201).json({
      id: event.id,
      name: event.name,
      location: event.location,
      guestAdded: { id, utorid, name },
      numGuests: updatedEvent.guests.length,
    });
  }
});

app.delete(
  "/events/:eventId/guests/:userId",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    const currentUser = req.user;

    const uid = parsePositiveWhole(req.params.userId);
    const eid = parsePositiveWhole(req.params.eventId);

    if (!uid || !eid) {
      return res.status(400).json({ error: "Invalid id parameters" });
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const event = await prisma.event.findUnique({
      where: { id: eid },
      include: { guests: true },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const guestExists = event.guests.some((guest) => guest.id === user.id);

    if (!guestExists) {
      return res.status(404).json({ error: "User is not a guest of the event" });
    }

    await prisma.event.update({
      where: { id: eid },
      data: {
        guests: {
          disconnect: { id: user.id },
        },
      },
    });

    return res.status(204).send();
  }
);

app.post("/events/:eventId/transactions", requireAuthenticatedUser, async (req, res) => {
  const currentUser = req.user;
  const { type, utorid, amount, remark } = req.body;

  const payload = await fetchEventOrError(req, res, {
    organizers: true,
    guests: true,
  });
  if (!payload) {
    return;
  }
  const { eventId: eid, event } = payload;

  const isOrganizer = event.organizers.some(
    (org) => org.id === currentUser.id
  );
  const requesterRole = (currentUser.role || "").toLowerCase();

  if (
    !isOrganizer &&
    requesterRole !== "manager" &&
    requesterRole !== "superuser"
  ) {
    return res
      .status(403)
      .json({
        error: "Only managers or higher, or event organizers can update events",
      });
  }

  const numericAmount = Number(amount);

  if (
    type !== "event" ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    numericAmount > event.pointsRemain
  ) {
    return res.status(400).json({ error: "Invalid payload" }); //passed
  }
  const resolvedRemark = remark === undefined ? null : remark;

  const hasSpecificRecipient =
    utorid !== undefined && utorid !== null && String(utorid).trim() !== "";

  if (hasSpecificRecipient) {
    const sanitizedUtorid =
      typeof utorid === "string" ? utorid.trim() : String(utorid).trim();

    if (!sanitizedUtorid) {
      return res.status(400).json({ error: "Invalid utorid" });
    }

    const findUser = await prisma.user.findUnique({
      where: { utorid: sanitizedUtorid },
    });

    if (!findUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isGuestRecord = await prisma.event.findFirst({
      where: { id: eid, guests: { some: { id: findUser.id } } },
      select: { id: true },
    });

    if (!isGuestRecord) {
      return res
        .status(400)
        .json({ error: "User is not a guest of the event" }); //passed
    }

    const pointsAwarded = Math.floor(numericAmount);

    const newTransaction = await prisma.transaction.create({
      data: {
        utorid: sanitizedUtorid,
        type,
        relatedId: eid,
        eventId: eid,
        remark: resolvedRemark,
        createdBy: currentUser.utorid,
        spent: 0,
        earned: pointsAwarded,
        amount: pointsAwarded,
        suspicious: false,
        processed: false,
      },
    });

    const prevPoints = findUser.points;
    const newPoints = prevPoints + pointsAwarded;
    const remain = event.pointsRemain - pointsAwarded;
    const reward = event.pointsAwarded + pointsAwarded;
    const updatedEvent = await prisma.event.update({
      where: { id: eid },
      data: {
        pointsRemain: remain,
        pointsAwarded: reward,
      },
    });
    await prisma.user.update({
      where: { id: findUser.id },
      data: {
        guest: { connect: { id: updatedEvent.id } },
        points: newPoints,
      },
    });

    return res.status(200).json({
      id: newTransaction.id,
      utorid: sanitizedUtorid,
      recipient: sanitizedUtorid,
      awarded: pointsAwarded,
      type,
      amount: newTransaction.amount,
      relatedId: eid,
      remark: newTransaction.remark,
      createdBy: newTransaction.createdBy,
      eventId: newTransaction.eventId,
    });
  } else {
    const guests = event.guests;

    const totalAward = numericAmount * guests.length;
    if (totalAward > event.pointsRemain) {
      return res.status(400).json({ error: "Not enough points remaining" });
    }

    const newTransactions = [];
    let pointsRemaining = event.pointsRemain;
    let pointsAwardedAggregate = event.pointsAwarded;

    for (const user of guests) {
      const newTransaction = await prisma.transaction.create({
        data: {
          utorid: user.utorid, //recipient transaction
          type,
          relatedId: eid,
          eventId: eid,
          remark: resolvedRemark,
          createdBy: currentUser.utorid,
          spent: 0,
          earned: numericAmount,
          suspicious: false,
          processed: false,
          amount: numericAmount,
        },
      });

      const prevPoints = user.points;
      const newPoints = prevPoints + numericAmount;
      pointsRemaining -= numericAmount;
      pointsAwardedAggregate += numericAmount;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          guest: { connect: { id: event.id } },
          points: newPoints,
        },
      });

      newTransactions.push({
        id: newTransaction.id,
        recipient: user.utorid,
        awarded: numericAmount,
        type,
        relatedId: eid,
        remark: resolvedRemark,
        createdBy: newTransaction.createdBy,
        eventId: eid,
      });
    }

    await prisma.event.update({
      where: { id: eid },
      data: {
        pointsRemain: pointsRemaining,
        pointsAwarded: pointsAwardedAggregate,
      },
    });

    return res.status(200).json(newTransactions);
  }
});

app.post(
  "/promotions",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    

    const {
      name,
      description,
      type,
      startTime,
      endTime,
      minSpending,
      rate,
      points,
    } = req.body;

    try {
      if (
        name == null ||
        description == null ||
        type == null ||
        startTime == null ||
        endTime == null
      ) {
        return res.status(400).json({ error: "missing required fields" });
      }

      const incomingType =
        typeof type === "string" ? type.trim().toLowerCase() : "";
      if (incomingType !== "automatic" && incomingType !== "one-time") {
        return res
          .status(400)
          .json({ error: 'type must be either "automatic" or "one-time"' });
      }
      const storedType =
        incomingType === "one-time" ? "onetime" : incomingType;

      const start = new Date(startTime);
      const end = new Date(endTime);
      const now = new Date();

      if (isNaN(start.getTime()))
        return res.status(400).json({ error: "invalid startTime format" });
      if (isNaN(end.getTime()))
        return res.status(400).json({ error: "invalid endTime format" });
      if (start < now)
        return res
          .status(400)
          .json({ error: "startTime cannot be in the past" });
      if (end <= start)
        return res
          .status(400)
          .json({ error: "endTime must be after startTime" });

      if (
        minSpending !== null &&
        (typeof minSpending !== "number" || minSpending <= 0)
      ) {
        return res
          .status(400)
          .json({ error: "minSpending must be a positive numeric value" });
      }
      if (rate !== null && (typeof rate !== "number" || rate <= 0)) {
        return res
          .status(400)
          .json({ error: "rate must be a positive numeric value" });
      }
      if (points !== null && (!Number.isInteger(points) || points < 0)) {
        return res
          .status(400)
          .json({ error: "points must be a positive integer value" });
      }

      const created = await prisma.promotion.create({
        data: {
          name,
          description,
          type: storedType,
          isOneTime: incomingType === "one-time",
          startTime: start,
          endTime: end,
          minSpending,
          rate,
          points,
        },
      });

      res.status(201).json({
        id: created.id,
        name: created.name,
        description: created.description,
        type: created.type,
        startTime: created.startTime.toISOString(),
        endTime: created.endTime.toISOString(),
        minSpending: created.minSpending,
        rate: created.rate,
        points: created.points,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "internal server error" });
    }
  }
);

app.get("/promotions", requireAuthenticatedUser, async (req, res) => {
  

  

  try {
    const filters = mergeFilterSources(req.query, req.body);
    const nameRaw = digFilterValue(filters, "name");
    const typeRaw = digFilterValue(filters, "type");
    const startedRaw = digFilterValue(filters, "started");
    const endedRaw = digFilterValue(filters, "ended");
    const pageRaw = digFilterValue(filters, "page");
    const limitRaw = digFilterValue(filters, "limit");

    const normalizedName =
      typeof nameRaw === "string" ? nameRaw.trim().toLowerCase() : "";
    const normalizedType =
      typeof typeRaw === "string" ? typeRaw.trim().toLowerCase() : undefined;

    const userRole = (req.user.role || "").toUpperCase();
    const isPrivileged = userRole === "MANAGER" || userRole === "SUPERUSER";
    const restrictToAvailable =
      userRole === "REGULAR" || userRole === "CASHIER";
    const now = new Date();

    const pageNum =
      pageRaw === undefined || pageRaw === null
        ? 1
        : parsePositiveWhole(pageRaw);
    const limitNum =
      limitRaw === undefined || limitRaw === null
        ? 10
        : parsePositiveWhole(limitRaw);

    if (!pageNum || !limitNum) {
      return res.status(400).json({ error: "invalid pagination values" });
    }

    if (startedRaw !== undefined && endedRaw !== undefined) {
      return res
        .status(400)
        .json({ error: "cannot specify both started and ended" });
    }

    const where = {};

    if (normalizedType) {
      if (
        normalizedType !== "automatic" &&
        normalizedType !== "onetime" &&
        normalizedType !== "one-time"
      ) {
        return res
          .status(400)
          .json({
            error: 'type must be either "automatic" or "one-time"',
          });
      }
      where.type =
        normalizedType === "one-time" ? "onetime" : normalizedType;
    }

    if (restrictToAvailable) {
      where.startTime = { lte: now };
      where.endTime = { gte: now };
    } else {
      if (startedRaw !== undefined) {
        const parsedStarted = interpretBooleanFlag(startedRaw);
        if (parsedStarted === null) {
          return res.status(400).json({ error: "invalid started value" });
        }
        where.startTime = parsedStarted ? { lte: now } : { gt: now };
      }
      if (endedRaw !== undefined) {
        const parsedEnded = interpretBooleanFlag(endedRaw);
        if (parsedEnded === null) {
          return res.status(400).json({ error: "invalid ended value" });
        }
        where.endTime = parsedEnded ? { lte: now } : { gt: now };
      }
    }

    const selection = {
      id: true,
      name: true,
      type: true,
      endTime: true,
      minSpending: true,
      rate: true,
      points: true,
      ...(isPrivileged ? { startTime: true } : {}),
    };

    let usedPromotionIds = new Set();
    if (restrictToAvailable) {
      const usages = await prisma.usage.findMany({
        where: { userId: req.user.id },
        select: { promotionId: true },
      });
      usedPromotionIds = new Set(usages.map((usage) => usage.promotionId));
    }

    const offset = (pageNum - 1) * limitNum;
    const needsPostFilter =
      restrictToAvailable || Boolean(normalizedName);

    const baseQuery = {
      where,
      orderBy: { id: "asc" },
      select: selection,
    };

    const applyNameFilter = (promotion) =>
      !normalizedName ||
      promotion.name.toLowerCase().includes(normalizedName);
    const applyUsageFilter = (promotion) =>
      !restrictToAvailable || !usedPromotionIds.has(promotion.id);
    const formatPromotion = (promotion) => {
      const response = {
        id: promotion.id,
        name: promotion.name,
        type: promotion.type,
        endTime: promotion.endTime?.toISOString(),
        minSpending: promotion.minSpending,
        rate: promotion.rate,
        points: promotion.points,
      };
      if (isPrivileged) {
        response.startTime = promotion.startTime?.toISOString();
      }
      return response;
    };

    if (needsPostFilter) {
      const allPromotions = await prisma.promotion.findMany(baseQuery);
      const filtered = allPromotions
        .filter(applyNameFilter)
        .filter(applyUsageFilter);

      if (filtered.length > 0 && offset >= filtered.length) {
        return res.status(400).json({ error: "page/limit too large" });
      }

      const paged = filtered.slice(offset, offset + limitNum);
      return res
        .status(200)
        .json({
          count: filtered.length,
          results: paged.map(formatPromotion),
        });
    }

    const count = await prisma.promotion.count({ where });
    if (count > 0 && offset >= count) {
      return res.status(400).json({ error: "page/limit too large" });
    }

    const results = await prisma.promotion.findMany({
      ...baseQuery,
      skip: offset,
      take: limitNum,
    });

    res
      .status(200)
      .json({
        count,
        results: results.map(formatPromotion),
      });
  } catch (error) {
    console.error("Error in /promotions:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch promotions", details: error.message });
  }
});

app.get("/promotions/:promotionId", requireAuthenticatedUser, async (req, res) => {
  

  try {
    const id = parsePositiveWhole(req.params.promotionId);
    if (!id)
      return res.status(404).json({ error: "promotion not found" });

    const promotion = await prisma.promotion.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        startTime: true,
        endTime: true,
        minSpending: true,
        rate: true,
        points: true,
      },
    });
    if (!promotion)
      return res.status(404).json({ error: "promotion not found" });

    const now = new Date();
    const role = req.user.role.toUpperCase();
    const isMgr = role === "MANAGER" || role === "SUPERUSER";

    if (isMgr) {
      return res.status(200).json(promotion);
    }

    if (promotion.startTime > now || promotion.endTime < now) {
      return res.status(404).json({ error: "promotion is inactive" });
    }

    return res.status(200).json({
      id: promotion.id,
      name: promotion.name,
      description: promotion.description,
      type: promotion.type,
      endTime: promotion.endTime,
      minSpending: promotion.minSpending,
      rate: promotion.rate,
      points: promotion.points,
    });
  } catch (error) {
    console.error("Error retrieving promotion:", error);
    res.status(500).json({ error: "failed to retrieve promotion" });
  }
});

app.patch("/promotions/:promotionId", requireAuthenticatedUser, enforceRoleClearance("manager"), async (req, res) => {
  

  try {
    const id = parsePositiveWhole(req.params.promotionId);
    if (!id)
      return res.status(404).json({ error: "promotion not found" });

    const existing = await prisma.promotion.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ error: "promotion not found" });

    const name = coalesceNullable(req.body.name);
    const description = coalesceNullable(req.body.description);
    const typeInput = coalesceNullable(req.body.type);
    const startTimeInput = coalesceNullable(req.body.startTime);
    const endTimeInput = coalesceNullable(req.body.endTime);
    const minSpendingInput = coalesceNullable(req.body.minSpending);
    const rateInput = coalesceNullable(req.body.rate);
    const pointsInput = coalesceNullable(req.body.points);

    if (
      name === undefined &&
      description === undefined &&
      typeInput === undefined &&
      startTimeInput === undefined &&
      endTimeInput === undefined &&
      minSpendingInput === undefined &&
      rateInput === undefined &&
      pointsInput === undefined
    ) {
      return res
        .status(400)
        .json({ error: "provide at least one field to update" });
    }

    let normalizedType;
    if (typeInput !== undefined) {
      normalizedType =
        typeof typeInput === "string" ? typeInput.trim().toLowerCase() : "";
      if (
        normalizedType !== "automatic" &&
        normalizedType !== "onetime" &&
        normalizedType !== "one-time"
      ) {
        return res
          .status(400)
          .json({ error: 'type must be either "automatic" or "one-time"' });
      }
      normalizedType =
        normalizedType === "one-time" ? "onetime" : normalizedType;
    }

    let parsedStart, parsedEnd;
    if (startTimeInput !== undefined) {
      parsedStart = new Date(startTimeInput);
      if (isNaN(parsedStart.getTime()))
        return res
          .status(400)
          .json({
            error:
              "invalid startTime format. Use ISO 8601 like 2025-12-01T00:00:00Z",
          });
    }
    if (endTimeInput !== undefined) {
      parsedEnd = new Date(endTimeInput);
      if (isNaN(parsedEnd.getTime()))
        return res
          .status(400)
          .json({
            error:
              "invalid endTime format. Use ISO 8601 like 2025-12-31T23:59:59Z",
          });
    }

    const effectiveStart = parsedStart ?? new Date(existing.startTime);
    const effectiveEnd = parsedEnd ?? new Date(existing.endTime);
    if (effectiveStart >= effectiveEnd)
      return res.status(400).json({ error: "endTime must be after startTime" });

    const now = new Date();

    if (parsedStart && parsedStart < now)
      return res.status(400).json({ error: "startTime cannot be in the past" });
    if (parsedEnd && parsedEnd < now)
      return res.status(400).json({ error: "endTime cannot be in the past" });

    const hasStarted = new Date(existing.startTime) < now;
    const hasEnded = new Date(existing.endTime) < now;

    if (hasEnded)
      return res
        .status(400)
        .json({ error: "cannot update promotion after it has ended" });

    if (hasStarted) {
      if (
        name !== undefined ||
        description !== undefined ||
        normalizedType !== undefined ||
        parsedStart !== undefined ||
        minSpendingInput !== undefined ||
        rateInput !== undefined ||
        pointsInput !== undefined
      ) {
        return res.status(400).json({
          error:
            "cannot update name, description, type, startTime, minSpending, rate, or points after promotion has started",
        });
      }
    }

    if (
      minSpendingInput !== undefined &&
      (isNaN(minSpendingInput) || Number(minSpendingInput) < 0)
    ) {
      return res
        .status(400)
        .json({ error: "minSpending must be a positive number" });
    }
    if (rateInput !== undefined && (isNaN(rateInput) || Number(rateInput) <= 0)) {
      return res.status(400).json({ error: "rate must be a positive number" });
    }
    if (
      pointsInput !== undefined &&
      (isNaN(pointsInput) ||
        Number(pointsInput) < 0 ||
        !Number.isInteger(Number(pointsInput)))
    ) {
      return res
        .status(400)
        .json({ error: "points must be a positive integer" });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (normalizedType !== undefined) {
      data.type = normalizedType;
      data.isOneTime = normalizedType === "onetime";
    }
    if (parsedStart !== undefined) data.startTime = parsedStart;
    if (parsedEnd !== undefined) data.endTime = parsedEnd;
    if (minSpendingInput !== undefined)
      data.minSpending = Number(minSpendingInput);
    if (rateInput !== undefined) data.rate = Number(rateInput);
    if (pointsInput !== undefined) data.points = Number(pointsInput);

    const updated = await prisma.promotion.update({ where: { id }, data });

    const response = {
      id: updated.id,
      name: updated.name,
      type: updated.type,
    };
    if (name !== undefined) response.name = updated.name;
    if (description !== undefined) response.description = updated.description;
    if (parsedStart !== undefined) response.startTime = updated.startTime;
    if (parsedEnd !== undefined) response.endTime = updated.endTime;
    if (minSpendingInput !== undefined)
      response.minSpending = updated.minSpending;
    if (rateInput !== undefined) response.rate = updated.rate;
    if (pointsInput !== undefined) response.points = updated.points;

    return res.status(200).json(response);
  } catch (err) {
    console.error("Error updating promotion:", err);
    return res.status(500).json({ error: "failed to update promotion" });
  }
});

app.delete(
  "/promotions/:promotionId",
  requireAuthenticatedUser,
  enforceRoleClearance("manager"),
  async (req, res) => {
    

    try {
      const id = parsePositiveWhole(req.params.promotionId);
      if (!id)
        return res.status(404).json({ error: "promotion not found" });

      const promotion = await prisma.promotion.findUnique({ where: { id } });
      if (!promotion)
        return res.status(404).json({ error: "promotion not found" });

      if (new Date(promotion.startTime) <= new Date()) {
        return res
          .status(403)
          .json({ error: "cannot delete promotion that has already started" });
      }

      await prisma.promotion.delete({ where: { id } });
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting promotion:", error);
      return res.status(500).json({ error: "failed to delete promotion" });
    }
  }
);

let server = null;
if (require.main === module) {
  server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  server.on("error", (err) => {
    console.error(`cannot start server: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { app };
