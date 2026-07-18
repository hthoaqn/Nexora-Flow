// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// pdf-parse / pdfjs may touch DOMMatrix at import time (Node has no DOM)
if (typeof globalThis.DOMMatrix === "undefined") {
  // minimal stub — enough for library load
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {}
    multiplySelf() {
      return this;
    }
    translateSelf() {
      return this;
    }
    scaleSelf() {
      return this;
    }
    inverse() {
      return this;
    }
  };
}
if (typeof globalThis.Path2D === "undefined") {
  globalThis.Path2D = class Path2D {};
}

import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import { db } from "./backend/db";
import { getPartnerProvider } from "./backend/partnerProvider";
import { MatchingService } from "./backend/matchingService";
import { AiService } from "./backend/aiService";
import {
  StartupProfileDTO,
  CustomFieldDTO,
  ConflictingField,
  SimulationMetrics,
} from "./types";

// Custom token utility for session authentication (simulates JWT securely)
const SECRET = "deal-flow-matchmaker-secure-key-2026";

function generateToken(payload: {
  id: string;
  email: string;
  fullName: string;
  role: "startup";
}): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64");
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 }),
  ).toString("base64");
  return `${header}.${body}.mockedsignature`;
}

function verifyToken(
  token: string,
): { id: string; email: string; fullName: string; role: "startup" } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const body = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    if (body.exp < Date.now()) return null;
    return body;
  } catch (e) {
    return null;
  }
}

const createEmptyProfileBackend = (): StartupProfileDTO => ({
  id: null,
  startupName: "",
  logoUrl: null,
  website: null,
  foundingYear: null,
  address: null,
  country: null,
  contactEmail: null,
  phoneNumber: null,
  industries: [],
  technologies: [],
  markets: [],
  targetCustomers: [],
  stage: "",
  businessModel: "",
  description: "",
  problemStatement: "",
  solutionDescription: "",
  productDescription: "",
  fundingNeed: null,
  currency: "USD",
  partnershipNeeds: [],
  teamCapabilities: [],
  traction: {
    customerCount: null,
    userCount: null,
    monthlyRevenue: null,
    annualRevenue: null,
    growthRate: null,
    achievements: [],
  },
  teamMembers: [],
  useOfFunds: [],
  profileCompletion: 0,
  status: "draft",
  confirmedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  customFields: [],
  conflictingFields: [],
});

function logStep(
  stepName: string,
  userId: string,
  details: {
    startupProfileId?: string;
    fileId?: string;
    elapsedMs?: number;
    error?: string;
    updatedCount?: number;
    customCreatedCount?: number;
    conflictCount?: number;
  },
) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event: stepName,
      userId,
      ...details,
    }),
  );
}

interface UnifiedExtractionResult {
  standardFields: Record<
    string,
    {
      value: any;
      confidence: number;
      sourceText?: string;
      sourceFileId?: string;
    }
  >;
  customFields: Array<{
    key: string;
    label: string;
    value: any;
    type:
      | "text"
      | "number"
      | "percentage"
      | "currency"
      | "date"
      | "list"
      | "boolean";
    category: string;
    confidence: number;
    sourceText?: string | null;
    sourceFileId?: string | null;
    isInferred?: boolean;
    requiresConfirmation?: boolean;
  }>;
  unresolvedInformation: string[];
  warnings: string[];
}

function normalizeToUnifiedExtraction(
  raw: any,
  sourceFileId: string | null = null,
): UnifiedExtractionResult {
  const result: UnifiedExtractionResult = {
    standardFields: {},
    customFields: [],
    unresolvedInformation: raw.unresolvedInformation || [],
    warnings: raw.warnings || [],
  };

  const oldTypeToStandardField: Record<string, string> = {
    company_name: "startupName",
    website: "website",
    email: "contactEmail",
    phone: "phoneNumber",
    industry: "industries",
    technology: "technologies",
    market: "markets",
    startup_stage: "stage",
    business_model: "businessModel",
    description: "description",
    tagline: "description",
    problem: "problemStatement",
    solution: "solutionDescription",
    funding: "fundingNeed",
    partnership: "partnershipNeeds",
    team: "teamCapabilities",
    customer: "targetCustomers",
    revenue: "tractionMonthlyRevenue",
    traction: "tractionAchievements",
  };

  if (raw.standardFields || raw.customFields) {
    const std = raw.standardFields || {};
    Object.keys(std).forEach((key) => {
      const field = std[key];
      if (field && field.value !== undefined && field.value !== null) {
        result.standardFields[key] = {
          value: field.value,
          confidence:
            typeof field.confidence === "number" ? field.confidence : 0.9,
          sourceText: field.sourceText || "",
          sourceFileId: field.sourceFileId || sourceFileId || "",
        };
      }
    });

    const cust = raw.customFields || [];
    cust.forEach((cf: any) => {
      if (cf && cf.key && cf.value !== undefined && cf.value !== null) {
        result.customFields.push({
          key: cf.key,
          label: cf.label || cf.key,
          value: cf.value,
          type: cf.type || "text",
          category: cf.category || "other",
          confidence: typeof cf.confidence === "number" ? cf.confidence : 0.9,
          sourceText: cf.sourceText || null,
          sourceFileId: cf.sourceFileId || sourceFileId || null,
          isInferred: Boolean(cf.isInferred),
          requiresConfirmation: Boolean(cf.requiresConfirmation),
        });
      }
    });
  } else if (Array.isArray(raw.fields)) {
    raw.fields.forEach((item: any) => {
      if (!item || !item.type) return;
      const stdKey = oldTypeToStandardField[item.type] || item.mappedField;
      const confidence =
        typeof item.confidence === "number" ? item.confidence : 0.9;
      const sourceText = item.exact_text || item.sourceText || "";

      if (stdKey && stdKey !== "other") {
        result.standardFields[stdKey] = {
          value: item.value,
          confidence,
          sourceText,
          sourceFileId: sourceFileId || "",
        };
      } else {
        const key = item.field || item.type || `field_${Date.now()}`;
        result.customFields.push({
          key,
          label: item.label || item.field || item.type,
          value: item.value,
          type: "text",
          category: item.type || "other",
          confidence,
          sourceText,
          sourceFileId,
          isInferred: false,
          requiresConfirmation: confidence < 0.8,
        });
      }
    });
  }

  return result;
}

function mergeExtractedFields(
  currentProfile: StartupProfileDTO | null,
  extractedData: UnifiedExtractionResult,
  sourceFileId: string | null,
) {
  const profile = currentProfile
    ? JSON.parse(JSON.stringify(currentProfile))
    : createEmptyProfileBackend();

  const updatedFields: string[] = [];
  const createdCustomFields: string[] = [];
  const conflictingFields: ConflictingField[] = profile.conflictingFields || [];
  const skippedFields: string[] = [];

  const standardFields = extractedData.standardFields || {};
  const customFields = extractedData.customFields || [];

  Object.keys(standardFields).forEach((key) => {
    const extracted = standardFields[key];
    if (
      !extracted ||
      extracted.value === null ||
      extracted.value === undefined ||
      extracted.value === ""
    ) {
      return;
    }

    let value = extracted.value;

    // Normalization helper
    const isArrayField = [
      "industries",
      "technologies",
      "markets",
      "targetCustomers",
      "partnershipNeeds",
      "teamCapabilities",
    ].includes(key);
    if (isArrayField) {
      if (typeof value === "string") {
        value = value
          .split(/[,;\n\r]+/)
          .map((s: string) => s.trim())
          .filter(Boolean);
      } else if (!Array.isArray(value)) {
        value = value ? [value] : [];
      } else {
        value = value.map((s: any) => String(s).trim()).filter(Boolean);
      }
      value.sort();
    }

    if (key === "foundingYear" || key === "fundingNeed") {
      const num = Number(value);
      value = isNaN(num) ? null : num;
    }

    if (key === "tractionAchievements") {
      if (typeof value === "string") {
        value = value
          .split(/[,;\n\r]+/)
          .map((s: string) => s.trim())
          .filter(Boolean);
      } else if (!Array.isArray(value)) {
        value = value ? [value] : [];
      } else {
        value = value.map((s: any) => String(s).trim()).filter(Boolean);
      }
      value.sort();
    }

    const isTractionNumber = [
      "tractionCustomerCount",
      "tractionUserCount",
      "tractionMonthlyRevenue",
      "tractionAnnualRevenue",
      "tractionGrowthRate",
    ].includes(key);
    if (isTractionNumber) {
      const num = Number(value);
      value = isNaN(num) ? null : num;
    }

    let currentVal: any = null;
    let isTraction = false;
    let tractionKey = "";

    if (key.startsWith("traction") && key !== "tractionAchievements") {
      isTraction = true;
      tractionKey = key.replace("traction", "");
      tractionKey = tractionKey.charAt(0).toLowerCase() + tractionKey.slice(1);
      if (profile.traction) {
        currentVal = (profile.traction as any)[tractionKey];
      }
    } else if (key === "tractionAchievements") {
      isTraction = true;
      tractionKey = "achievements";
      if (profile.traction) {
        currentVal = profile.traction.achievements;
      }
    } else {
      currentVal = (profile as any)[key];
    }

    const normalizeForComparison = (val: any) => {
      if (val === null || val === undefined) return "";
      if (Array.isArray(val)) {
        return val
          .map((s: any) => String(s).trim().toLowerCase())
          .sort()
          .join(",");
      }
      if (typeof val === "string") {
        return val.trim().toLowerCase().replace(/\s+/g, " ");
      }
      return String(val);
    };

    const normCurrent = normalizeForComparison(currentVal);
    const normNew = normalizeForComparison(value);

    if (!normCurrent) {
      if (isTraction) {
        if (!profile.traction) {
          profile.traction = {
            customerCount: null,
            userCount: null,
            monthlyRevenue: null,
            annualRevenue: null,
            growthRate: null,
            achievements: [],
          };
        }
        (profile.traction as any)[tractionKey] = value;
      } else {
        (profile as any)[key] = value;
      }
      updatedFields.push(key);
    } else if (normCurrent === normNew) {
      skippedFields.push(key);
    } else {
      const alreadyHasConflict = conflictingFields.some(
        (c) => c.field === key && c.status === "pending_review",
      );
      if (!alreadyHasConflict) {
        conflictingFields.push({
          field: key,
          currentValue: currentVal,
          proposedValue: value,
          sourceFileId,
          status: "pending_review",
        });
      }
    }
  });

  if (!profile.customFields) {
    profile.customFields = [];
  }

  customFields.forEach((cf: any) => {
    if (
      !cf ||
      !cf.key ||
      cf.value === null ||
      cf.value === undefined ||
      cf.value === ""
    )
      return;

    const existingIndex = profile.customFields.findIndex(
      (existing: any) => existing.key === cf.key,
    );

    const newCustomField: CustomFieldDTO = {
      key: cf.key,
      label: cf.label || cf.key,
      value: cf.value,
      type: cf.type || "text",
      category: cf.category || "other",
      sourceFileId: sourceFileId || cf.sourceFileId || null,
      confidence: cf.confidence || 0.9,
      isAiGenerated: cf.isAiGenerated !== undefined ? cf.isAiGenerated : true,
      isInferred: cf.isInferred !== undefined ? cf.isInferred : false,
      requiresConfirmation:
        cf.requiresConfirmation !== undefined
          ? cf.requiresConfirmation
          : cf.confidence < 0.8,
      sourceText: cf.sourceText || null,
    };

    if (existingIndex === -1) {
      profile.customFields.push(newCustomField);
      createdCustomFields.push(cf.key);
    } else {
      const existing = profile.customFields[existingIndex];
      const normCurrent = String(existing.value).trim().toLowerCase();
      const normNew = String(cf.value).trim().toLowerCase();

      if (normCurrent === normNew) {
        skippedFields.push(`custom_${cf.key}`);
      } else {
        const conflictKey = `custom_${cf.key}`;
        const alreadyHasConflict = conflictingFields.some(
          (c) => c.field === conflictKey && c.status === "pending_review",
        );
        if (!alreadyHasConflict) {
          conflictingFields.push({
            field: conflictKey,
            currentValue: existing.value,
            proposedValue: cf.value,
            sourceFileId,
            status: "pending_review",
          });
        }
      }
    }
  });

  profile.conflictingFields = conflictingFields;

  return {
    profile,
    updatedFields,
    createdCustomFields,
    conflictingFields,
    skippedFields,
  };
}

// Request extension interface
interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; fullName: string; role: "startup" };
}

// Auth middleware
function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Missing authorization token.",
      data: null,
      error: {
        code: "UNAUTHORIZED",
        details: "Authorization header with Bearer token is required.",
      },
    });
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Invalid or expired token.",
      data: null,
      error: {
        code: "INVALID_TOKEN",
        details: "Your session has expired. Please log in again.",
      },
    });
  }

  req.user = decoded;
  next();
}

export async function createDealFlowApp() {
  const app = express();
  const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });
  const extractionsStore = new Map<string, any>();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "25mb" }));

  // ==========================================
  // API ROUTES (Must go FIRST)
  // ==========================================

  // Success API Response helper
  const sendSuccess = (
    res: Response,
    message: string,
    data: any = null,
    status = 200,
  ) => {
    res.status(status).json({
      success: true,
      message,
      data,
      error: null,
    });
  };

  // Error API Response helper
  const sendError = (
    res: Response,
    message: string,
    code: string,
    details: string,
    status = 400,
  ) => {
    res.status(status).json({
      success: false,
      message,
      data: null,
      error: { code, details },
    });
  };

  // 1. Auth: Register
  app.post("/api/v1/auth/register", (req, res) => {
    const { email, password, fullName, expectedStartupName, agreeTerms } =
      req.body;

    if (!email || !password || !fullName) {
      return sendError(
        res,
        "Vui lòng điền đầy đủ các trường bắt buộc",
        "VALIDATION_ERROR",
        "Họ tên, email và mật khẩu là bắt buộc.",
        422,
      );
    }

    if (!agreeTerms) {
      return sendError(
        res,
        "Bạn phải đồng ý với các điều khoản dịch vụ",
        "AGREEMENT_REQUIRED",
        "Đồng ý điều khoản dịch vụ là bắt buộc.",
        400,
      );
    }

    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      return sendError(
        res,
        "Email này đã tồn tại trong hệ thống",
        "EMAIL_EXISTS",
        "Hãy sử dụng email khác hoặc đăng nhập.",
        409,
      );
    }

    // Create startup user + empty profile shell
    const { user, profile } = db.createUser(email, password, fullName);

    // Save initial startup expectation name to session metadata if needed
    if (expectedStartupName) {
      db.updateStartupProfile(user.id, {
        startupName: expectedStartupName,
        contactEmail: email,
      } as Partial<StartupProfileDTO>);
    }

    const token = generateToken(user);
    sendSuccess(
      res,
      "Đăng ký tài khoản startup thành công",
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        accessToken: token,
        refreshToken: `${token}_refresh`,
      },
      201,
    ); // Code 201 Created
  });

  // 2. Auth: Login
  app.post("/api/v1/auth/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(
        res,
        "Vui lòng cung cấp email và mật khẩu",
        "MISSING_CREDENTIALS",
        "Email và mật khẩu là bắt buộc.",
        400,
      );
    }

    const user = db.findUserByEmail(email);
    if (!user || user.passwordHash !== password) {
      return sendError(
        res,
        "Email hoặc mật khẩu không đúng",
        "INVALID_CREDENTIALS",
        "Email hoặc mật khẩu không chính xác.",
        401,
      );
    }

    const token = generateToken(user);
    sendSuccess(res, "Đăng nhập thành công", {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken: token,
      refreshToken: `${token}_refresh`,
    });
  });

  // 3. Auth: Refresh Token
  app.post("/api/v1/auth/refresh", (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return sendError(
        res,
        "Refresh token is missing",
        "REFRESH_TOKEN_MISSING",
        "A refresh token must be supplied.",
        400,
      );
    }

    const originalToken = refreshToken.replace("_refresh", "");
    const decoded = verifyToken(originalToken);
    if (!decoded) {
      return sendError(
        res,
        "Invalid refresh token",
        "INVALID_REFRESH_TOKEN",
        "Your session cannot be renewed. Please log in again.",
        401,
      );
    }

    const newToken = generateToken({
      id: decoded.id,
      email: decoded.email,
      fullName: decoded.fullName,
      role: decoded.role,
    });
    sendSuccess(res, "Làm mới token thành công", {
      accessToken: newToken,
      refreshToken: `${newToken}_refresh`,
    });
  });

  // 4. Auth: Get Me
  app.get("/api/v1/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
    sendSuccess(res, "Lấy thông tin tài khoản thành công", { user: req.user });
  });

  // 5. Auth: Logout
  app.post("/api/v1/auth/logout", requireAuth, (req, res) => {
    sendSuccess(res, "Đăng xuất thành công");
  });

  // 6. Startup Profile: Get Profile
  app.get(
    "/api/v1/startup/profile",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const profile = db.getStartupProfile(req.user!.id);
      sendSuccess(res, "Lấy hồ sơ startup thành công", profile); // Returns null if not exists, which is correct
    },
  );

  // 7. Startup Profile: Confirm and Create
  app.post(
    "/api/v1/startup/profile/confirm-create",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const existing = db.getStartupProfile(req.user!.id);
      if (existing) {
        return sendError(
          res,
          "Hồ sơ startup đã tồn tại, hãy dùng PATCH để cập nhật",
          "PROFILE_EXISTS",
          "Hồ sơ đã có sẵn. Hãy sử dụng endpoint confirm-update.",
          409,
        );
      }

      try {
        const profile = db.createStartupProfile(req.user!.id, req.body);
        sendSuccess(
          res,
          "Khởi tạo hồ sơ startup chính thức thành công",
          profile,
          201,
        );
      } catch (e: any) {
        sendError(
          res,
          "Không thể tạo hồ sơ startup",
          "CREATE_PROFILE_FAILED",
          e.message,
        );
      }
    },
  );

  // 8. Startup Profile: Preview Update (Dry-run compare)
  app.post(
    "/api/v1/startup/profile/preview-update",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const current = db.getStartupProfile(req.user!.id);
      const draft = req.body;

      // Standardize & calculate dynamic changes list
      const diffs: any[] = [];
      if (current) {
        Object.keys(draft).forEach((key) => {
          const valCurrent = current[key as keyof StartupProfileDTO];
          const valDraft = draft[key];

          // Deep equal check for subobjects or direct match for primitives
          if (JSON.stringify(valCurrent) !== JSON.stringify(valDraft)) {
            diffs.push({
              field: key,
              currentValue: valCurrent,
              proposedValue: valDraft,
            });
          }
        });
      }

      // Determine completion score
      let fieldsFilled = 0;
      const fieldsToCount = [
        "startupName",
        "website",
        "contactEmail",
        "phoneNumber",
        "description",
        "stage",
        "businessModel",
      ];
      fieldsToCount.forEach((f) => {
        if (draft[f]) fieldsFilled++;
      });
      const completion = Math.round(
        (fieldsFilled / fieldsToCount.length) * 100,
      );

      sendSuccess(res, "Phân tích preview thay đổi thành công", {
        completion,
        differences: diffs,
        warnings:
          completion < 70
            ? [
                "Hồ sơ hoàn thiện dưới 70%. Hãy điền thêm thông tin cơ bản để có kết quả matching tốt nhất.",
              ]
            : [],
      });
    },
  );

  // 9. Startup Profile: Confirm Update (Only merge selected fields)
  app.patch(
    "/api/v1/startup/profile/confirm-update",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const { fieldsToApply, localDraft } = req.body;

      if (!localDraft) {
        return sendError(
          res,
          "Dữ liệu cập nhật không hợp lệ",
          "INVALID_MERGE_PAYLOAD",
          "Dữ liệu nháp là bắt buộc.",
          422,
        );
      }

      const current = db.getStartupProfile(req.user!.id);
      let mergedData: any = current ? JSON.parse(JSON.stringify(current)) : {};

      if (fieldsToApply && Array.isArray(fieldsToApply)) {
        // Only apply selected standard fields
        fieldsToApply.forEach((field: string) => {
          mergedData[field] = localDraft[field];
        });
        // Always preserve/update customFields and conflictingFields from localDraft if present
        if (localDraft.customFields) {
          mergedData.customFields = localDraft.customFields;
        }
        if (localDraft.conflictingFields) {
          mergedData.conflictingFields = localDraft.conflictingFields;
        }
      } else {
        // Update whole profile
        mergedData = {
          ...mergedData,
          ...localDraft,
        };
      }

      try {
        const updated = db.updateStartupProfile(req.user!.id, mergedData);
        sendSuccess(
          res,
          "Cập nhật và lưu phiên bản hồ sơ startup thành công",
          updated,
        );
      } catch (e: any) {
        sendError(
          res,
          "Lỗi lưu trữ hồ sơ chính thức",
          "MERGE_FAILED",
          e.message,
        );
      }
    },
  );

  // 10. Startup Profile: Profile Completion Analysis
  app.get(
    "/api/v1/startup/profile/completion",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const profile = db.getStartupProfile(req.user!.id);
      if (!profile) {
        return sendSuccess(res, "Chưa có hồ sơ", {
          profileCompletion: 0,
          missingFields: [
            "Hồ sơ chưa được khởi tạo. Hãy thiết lập hồ sơ ngay.",
          ],
        });
      }

      const missingFields: string[] = [];
      const fieldsMap: Record<string, string> = {
        startupName: "Tên Startup",
        logoUrl: "Logo",
        website: "Website",
        foundingYear: "Năm thành lập",
        address: "Địa chỉ",
        country: "Quốc gia",
        contactEmail: "Email liên hệ",
        phoneNumber: "Số điện thoại",
        description: "Mô tả ngắn",
        businessModel: "Mô hình kinh doanh",
        stage: "Giai đoạn phát triển",
        fundingNeed: "Nhu cầu gọi vốn",
      };

      let filledCount = 0;
      const totalFields = Object.keys(fieldsMap).length;

      Object.keys(fieldsMap).forEach((f) => {
        if (profile[f as keyof StartupProfileDTO]) {
          filledCount++;
        } else {
          missingFields.push(fieldsMap[f]);
        }
      });

      const completion = Math.round((filledCount / totalFields) * 100);

      sendSuccess(res, "Tính toán độ hoàn thiện hồ sơ", {
        profileCompletion: completion,
        missingFields,
        suggestions: missingFields.map(
          (f) => `Bổ sung "${f}" để nâng cao độ tin cậy khi matching với quỹ.`,
        ),
      });
    },
  );

  // 11. Startup Profile: Versions list
  app.get(
    "/api/v1/startup/profile/versions",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const list = db.getProfileVersions(req.user!.id);
      sendSuccess(res, "Lấy danh sách lịch sử phiên bản thành công", list);
    },
  );

  // 12. Startup Profile: Version Details
  app.get(
    "/api/v1/startup/profile/versions/:version_id",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const version = db.getProfileVersionById(
        req.user!.id,
        req.params.version_id,
      );
      if (!version) {
        return sendError(
          res,
          "Không tìm thấy phiên bản lịch sử được yêu cầu",
          "VERSION_NOT_FOUND",
          "Vui lòng kiểm tra lại version ID.",
          404,
        );
      }
      sendSuccess(res, "Lấy chi tiết phiên bản thành công", version);
    },
  );

  // 13. Startup Profile: Version Restore Preview
  app.post(
    "/api/v1/startup/profile/versions/:version_id/restore-preview",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const current = db.getStartupProfile(req.user!.id);
      const version = db.getProfileVersionById(
        req.user!.id,
        req.params.version_id,
      );

      if (!version) {
        return sendError(
          res,
          "Không tìm thấy phiên bản lịch sử được yêu cầu",
          "VERSION_NOT_FOUND",
          "Vui lòng kiểm tra lại version ID.",
          404,
        );
      }

      const diffs: any[] = [];
      if (current) {
        Object.keys(version.profileData).forEach((key) => {
          const valCurrent = current[key as keyof StartupProfileDTO];
          const valVer = version.profileData[key as keyof StartupProfileDTO];

          if (JSON.stringify(valCurrent) !== JSON.stringify(valVer)) {
            diffs.push({
              field: key,
              currentValue: valCurrent,
              proposedValue: valVer,
            });
          }
        });
      }

      sendSuccess(res, "Tạo so sánh khôi phục thành công", {
        versionData: version.profileData,
        differences: diffs,
      });
    },
  );

  // 14. Startup Profile: Confirm Restore Version
  app.post(
    "/api/v1/startup/profile/versions/:version_id/confirm-restore",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const version = db.getProfileVersionById(
        req.user!.id,
        req.params.version_id,
      );
      if (!version) {
        return sendError(
          res,
          "Không tìm thấy phiên bản lịch sử",
          "VERSION_NOT_FOUND",
          "Khôi phục thất bại.",
          404,
        );
      }

      const restoredProfile = db.updateStartupProfile(
        req.user!.id,
        version.profileData,
      );
      sendSuccess(
        res,
        `Khôi phục thành công về phiên bản #${version.versionNumber}`,
        restoredProfile,
      );
    },
  );

  // 15. AI Extractions: OCR Image Analysis (Multipart Form-Data)
  app.post(
    "/api/v1/startup/extractions/image",
    requireAuth,
    upload.single("file"),
    async (req: AuthenticatedRequest, res) => {
      const file = req.file;
      if (!file) {
        return sendError(
          res,
          "Không nhận được file ảnh",
          "INVALID_IMAGE_PAYLOAD",
          "Trường file là bắt buộc trong form-data.",
          400,
        );
      }

      const userId = req.user!.id;
      const startTime = Date.now();

      try {
        const base64Data = file.buffer.toString("base64");
        const mimeType = file.mimetype;

        logStep("FILE_UPLOADED", userId, { fileId: `img-${startTime}` });

        logStep("AI_ANALYSIS_STARTED", userId, { fileId: `img-${startTime}` });
        const extraction = await AiService.extractFromImage(
          base64Data,
          mimeType,
        );
        const aiTime = Date.now() - startTime;
        logStep("AI_ANALYSIS_COMPLETED", userId, {
          fileId: `img-${startTime}`,
          elapsedMs: aiTime,
        });

        // Save document record
        const docRecord = db.addStartupDocument(userId, {
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          storagePath: `/permanent-storage/${userId}/${file.originalname}`,
          extractionResult: extraction,
        });

        // Normalize
        const unified = normalizeToUnifiedExtraction(extraction, docRecord.id);

        // Get or create profile
        let profile = db.getStartupProfile(userId);
        let createdProfile = false;
        if (!profile) {
          profile = db.createStartupProfile(
            userId,
            createEmptyProfileBackend(),
          );
          createdProfile = true;
          logStep("PROFILE_CREATED", userId, {
            startupProfileId: profile.id || "",
          });
        }

        // Update sourceFileId
        Object.keys(unified.standardFields).forEach((key) => {
          unified.standardFields[key].sourceFileId = docRecord.id;
        });
        unified.customFields.forEach((cf) => {
          cf.sourceFileId = docRecord.id;
        });

        // Merge standard & custom fields
        const mergeResult = mergeExtractedFields(
          profile,
          unified,
          docRecord.id,
        );

        logStep("STANDARD_FIELDS_MERGED", userId, {
          startupProfileId: profile.id || "",
          updatedCount: mergeResult.updatedFields.length,
          conflictCount: mergeResult.conflictingFields.filter(
            (c) => c.status === "pending_review",
          ).length,
        });

        logStep("CUSTOM_FIELDS_CREATED", userId, {
          startupProfileId: profile.id || "",
          customCreatedCount: mergeResult.createdCustomFields.length,
        });

        // Save to database
        const updatedProfile = db.updateStartupProfile(
          userId,
          mergeResult.profile,
        );
        logStep("PROFILE_SAVED", userId, {
          startupProfileId: updatedProfile.id || "",
        });

        const fullExtraction = {
          ...extraction,
          status: "completed",
          extractionId: docRecord.id,
        };
        extractionsStore.set(docRecord.id, fullExtraction);

        sendSuccess(res, "Phân tích hình ảnh và cập nhật hồ sơ thành công", {
          success: true,
          profileId: updatedProfile.id,
          createdProfile,
          updatedFields: mergeResult.updatedFields,
          createdCustomFields: mergeResult.createdCustomFields,
          conflictingFields: mergeResult.conflictingFields,
          skippedFields: mergeResult.skippedFields,
          warnings: unified.warnings || [],
          profile: updatedProfile,
        });
      } catch (e: any) {
        logStep("PROFILE_UPDATE_FAILED", userId, {
          error: e.message || String(e),
        });
        console.error("OCR Image Analysis failed:", e);
        sendError(
          res,
          "Không thể phân tích ảnh",
          "AI_EXTRACTION_FAILED",
          e.message || "Lỗi bất ngờ xảy ra.",
          500,
        );
      }
    },
  );

  // 16. AI Extractions: Pitch Deck/Doc Analysis
  app.post(
    "/api/v1/startup/extractions/document",
    requireAuth,
    upload.single("file"),
    async (req: AuthenticatedRequest, res) => {
      const file = req.file;

      if (!file) {
        return sendError(
          res,
          "Không tìm thấy file tài liệu nào được tải lên",
          "FILE_REQUIRED",
          "Trường dữ liệu file multipart là bắt buộc.",
          400,
        );
      }

      const userId = req.user!.id;
      const startTime = Date.now();
      const filename = file.originalname;
      const extension = path.extname(filename).toLowerCase();
      const mimeType = file.mimetype;
      const fileSize = file.size;

      // 1. Legacy format check
      if (extension === ".doc" || extension === ".ppt") {
        return sendError(
          res,
          "Định dạng tài liệu cũ không được hỗ trợ",
          "LEGACY_FORMAT_NOT_SUPPORTED",
          "Hệ thống không hỗ trợ định dạng file .doc hoặc .ppt cũ. Vui lòng chuyển đổi sang .docx hoặc .pptx.",
          400,
        );
      }

      // 2. Allowed extensions check
      const allowedExtensions = [".pdf", ".docx", ".pptx"];
      if (!allowedExtensions.includes(extension)) {
        return sendError(
          res,
          "Định dạng tài liệu không hợp lệ",
          "INVALID_FILE_TYPE",
          "Hệ thống chỉ hỗ trợ các định dạng file .pdf, .docx, .pptx.",
          400,
        );
      }

      // 3. File size check (25MB)
      if (fileSize > 25 * 1024 * 1024) {
        return sendError(
          res,
          "Dung lượng file vượt quá giới hạn cho phép",
          "FILE_TOO_LARGE",
          "Vui lòng tải lên file có dung lượng dưới 25MB.",
          400,
        );
      }

      // 4. Sanitize filename
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");

      try {
        logStep("FILE_UPLOADED", userId, { fileId: `doc-${startTime}` });

        const parseStart = Date.now();
        const extraction = await AiService.extractFromDocumentBuffer(
          file.buffer,
          sanitizedFilename,
          mimeType,
        );
        const parseTime = Date.now() - parseStart;
        logStep("CONTENT_EXTRACTED", userId, {
          fileId: `doc-${startTime}`,
          elapsedMs: parseTime,
        });

        // Save document record
        const docRecord = db.addStartupDocument(userId, {
          fileName: filename,
          fileType: extension.replace(".", ""),
          fileSize: fileSize,
          storagePath: `/permanent-storage/${userId}/${filename}`,
          extractionResult: extraction,
        });

        // Normalize
        const unified = normalizeToUnifiedExtraction(extraction, docRecord.id);

        // Get or create profile
        let profile = db.getStartupProfile(userId);
        let createdProfile = false;
        if (!profile) {
          profile = db.createStartupProfile(
            userId,
            createEmptyProfileBackend(),
          );
          createdProfile = true;
          logStep("PROFILE_CREATED", userId, {
            startupProfileId: profile.id || "",
          });
        }

        // Update sourceFileId
        Object.keys(unified.standardFields).forEach((key) => {
          unified.standardFields[key].sourceFileId = docRecord.id;
        });
        unified.customFields.forEach((cf) => {
          cf.sourceFileId = docRecord.id;
        });

        // Merge standard & custom fields
        const mergeResult = mergeExtractedFields(
          profile,
          unified,
          docRecord.id,
        );

        logStep("STANDARD_FIELDS_MERGED", userId, {
          startupProfileId: profile.id || "",
          updatedCount: mergeResult.updatedFields.length,
          conflictCount: mergeResult.conflictingFields.filter(
            (c) => c.status === "pending_review",
          ).length,
        });

        logStep("CUSTOM_FIELDS_CREATED", userId, {
          startupProfileId: profile.id || "",
          customCreatedCount: mergeResult.createdCustomFields.length,
        });

        // Save to database
        const updatedProfile = db.updateStartupProfile(
          userId,
          mergeResult.profile,
        );
        logStep("PROFILE_SAVED", userId, {
          startupProfileId: updatedProfile.id || "",
        });

        const fullExtraction = {
          ...extraction,
          status: "completed",
          extractionId: docRecord.id,
          sourceFileName: filename,
          fileType: extension.replace(".", ""),
          sourceType: "document",
        };
        extractionsStore.set(docRecord.id, fullExtraction);

        sendSuccess(res, "Phân tích tài liệu và cập nhật hồ sơ thành công", {
          success: true,
          profileId: updatedProfile.id,
          createdProfile,
          updatedFields: mergeResult.updatedFields,
          createdCustomFields: mergeResult.createdCustomFields,
          conflictingFields: mergeResult.conflictingFields,
          skippedFields: mergeResult.skippedFields,
          warnings: unified.warnings || [],
          profile: updatedProfile,
        });
      } catch (e: any) {
        logStep("PROFILE_UPDATE_FAILED", userId, {
          error: e.message || String(e),
        });
        console.error("Document extraction failed in server.ts:", e);
        const errorCode = e.code || "DOCUMENT_EXTRACTION_FAILED";
        sendError(
          res,
          "Lỗi phân tích tài liệu",
          errorCode,
          e.message || "Lỗi bất ngờ xảy ra.",
          400,
        );
      }
    },
  );

  // 16b. AI Extractions: Get Specific Extraction by ID
  app.get(
    "/api/v1/startup/extractions/:extractionId",
    requireAuth,
    (req, res) => {
      const extraction = extractionsStore.get(req.params.extractionId);
      if (!extraction) {
        return sendError(
          res,
          "Không tìm thấy kết quả phân tích",
          "EXTRACTION_NOT_FOUND",
          "Mã phân tích không tồn tại hoặc đã hết hạn.",
          404,
        );
      }
      sendSuccess(res, "Lấy thông tin phân tích thành công", extraction);
    },
  );

  // 17. AI Extractions: Normalize
  app.post("/api/v1/startup/extractions/normalize", requireAuth, (req, res) => {
    // Normalizes client fields directly, without saving to database
    sendSuccess(res, "Chuẩn hóa dữ liệu thành công", req.body);
  });

  // 18. AI Extractions: Clear Draft / Temp files
  app.delete(
    "/api/v1/startup/extractions/:extraction_id",
    requireAuth,
    (req, res) => {
      sendSuccess(res, "Xóa dữ liệu file tạm thành công");
    },
  );

  // 19. AI Extractions: Confirm Keep Documents
  app.post(
    "/api/v1/startup/extractions/:extraction_id/confirm-files",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const { fileName, fileType, fileSize, extractionFields } = req.body;

      const docRecord = db.addStartupDocument(req.user!.id, {
        fileName: fileName || "Document.pdf",
        fileType: fileType || "application/pdf",
        fileSize: fileSize || 1024,
        storagePath: `/permanent-storage/${req.user!.id}/${fileName}`,
        extractionResult: extractionFields || {},
      });

      sendSuccess(res, "Đã đính kèm tài liệu chính thức vào hồ sơ", docRecord);
    },
  );

  // 20. Partners: Query Active list
  app.get("/api/v1/partners", requireAuth, async (req, res) => {
    try {
      const provider = getPartnerProvider();
      let partners = await provider.listActivePartners(req.query);

      // Server-side filtering by search query and organizationType if any
      const search =
        typeof req.query.search === "string"
          ? req.query.search.toLowerCase().trim()
          : "";
      const orgType =
        typeof req.query.organizationType === "string"
          ? req.query.organizationType.toLowerCase().trim()
          : "";

      if (orgType) {
        partners = partners.filter(
          (p) => p.organizationType.toLowerCase() === orgType,
        );
      }

      if (search) {
        partners = partners.filter(
          (p) =>
            p.organizationName.toLowerCase().includes(search) ||
            p.description.toLowerCase().includes(search) ||
            p.interestedIndustries.some((i) =>
              i.toLowerCase().includes(search),
            ) ||
            p.interestedTechnologies.some((t) =>
              t.toLowerCase().includes(search),
            ),
        );
      }

      const total = partners.length;

      // Pagination
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 5;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedPartners = partners.slice(startIndex, endIndex);

      sendSuccess(res, "Lấy danh sách đối tác doanh nghiệp thành công", {
        items: paginatedPartners,
        total,
      });
    } catch (e: any) {
      sendError(
        res,
        "Không thể tải danh sách đối tác",
        "LOAD_PARTNERS_FAILED",
        e.message,
        500,
      );
    }
  });

  // 21. Partners: Get detailed partner (read-only for startups)
  app.get("/api/v1/partners/:partner_id", requireAuth, async (req, res) => {
    try {
      const provider = getPartnerProvider();
      const partner = await provider.getPartnerById(req.params.partner_id);
      if (!partner) {
        return sendError(
          res,
          "Không tìm thấy đối tác",
          "PARTNER_NOT_FOUND",
          "Đối tác không tồn tại hoặc đã ngừng hoạt động.",
          404,
        );
      }
      sendSuccess(res, "Lấy chi tiết đối tác thành công", partner);
    } catch (e: any) {
      sendError(
        res,
        "Không thể tải chi tiết đối tác",
        "LOAD_PARTNER_FAILED",
        e.message,
        500,
      );
    }
  });

  // 22. Matches: Run Batch Match
  app.post(
    "/api/v1/startup/matches/run",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user!.id;
      const timestamp = new Date().toISOString();
      console.log(
        `[${timestamp}] [MATCH_RUN] [STEP 1] Bắt đầu tiến trình matching cho user ID: ${userId}`,
      );
      const isLocalMode =
        (process.env.MATCHING_DATA_PROVIDER || "local").toLowerCase() ===
        "local";

      let startupProfile;
      if (isLocalMode && req.body.confirmedProfile) {
        startupProfile = req.body.confirmedProfile;
      } else {
        startupProfile = db.getStartupProfile(userId);
      }

      if (!startupProfile) {
        console.warn(
          `[${timestamp}] [MATCH_RUN] Thất bại - Không tìm thấy hồ sơ startup chính thức cho user ID: ${userId}`,
        );
        return sendError(
          res,
          "Bạn chưa khởi tạo hồ sơ startup chính thức",
          "PROFILE_NOT_CONFIRMED",
          'Vui lòng thiết lập và bấm "Xác nhận và tạo hồ sơ" trước khi chạy matching.',
          409,
        );
      }

      console.log(
        `[${timestamp}] [MATCH_RUN] [STEP 2] Đã tải thông tin startup profile: "${startupProfile.startupName || "N/A"}", trạng thái: "${startupProfile.status || "N/A"}"`,
      );

      // Check minimum required fields for matching
      const missingFields: string[] = [];
      if (!startupProfile.startupName?.trim())
        missingFields.push("Tên Startup");
      if (!startupProfile.contactEmail?.trim())
        missingFields.push("Email liên hệ");
      if (!startupProfile.description?.trim()) missingFields.push("Mô tả ngắn");
      if (!startupProfile.stage?.trim())
        missingFields.push("Giai đoạn phát triển");
      if (
        !Array.isArray(startupProfile.industries) ||
        startupProfile.industries.length === 0
      )
        missingFields.push("Lĩnh vực hoạt động");
      if (
        !Array.isArray(startupProfile.technologies) ||
        startupProfile.technologies.length === 0
      )
        missingFields.push("Công nghệ cốt lõi");
      if (
        !Array.isArray(startupProfile.markets) ||
        startupProfile.markets.length === 0
      )
        missingFields.push("Thị trường hoạt động");

      if (missingFields.length > 0) {
        console.warn(
          `[${timestamp}] [MATCH_RUN] Thất bại - Hồ sơ chưa đủ điều kiện cho user ID: ${userId}. Thiếu: ${missingFields.join(", ")}`,
        );
        return sendError(
          res,
          `Hồ sơ chưa đủ điều kiện để chạy so khớp. Thiếu các trường: ${missingFields.join(", ")}`,
          "PROFILE_INCOMPLETE_FOR_MATCHING",
          `Để đạt hiệu quả so khớp tối ưu, vui lòng bổ sung đầy đủ các thông tin: ${missingFields.join(", ")}.`,
          422,
        );
      }

      try {
        console.log(
          `[${timestamp}] [MATCH_RUN] [STEP 3] Tải thông tin partners từ PartnerProvider...`,
        );
        const provider = getPartnerProvider();
        const partners = await provider.listActivePartners();

        if (!partners || partners.length === 0) {
          console.warn(
            `[${timestamp}] [MATCH_RUN] [STEP 3] Không tìm thấy đối tác đang hoạt động nào trong hệ thống.`,
          );
          return sendError(
            res,
            "Chưa có đối tác đang hoạt động trong hệ thống",
            "NO_ACTIVE_PARTNERS",
            "Vui lòng quay lại sau hoặc liên hệ với ban quản trị.",
            404,
          );
        }

        console.log(
          `[${timestamp}] [MATCH_RUN] [STEP 3 COMPLETE] Đã lấy được ${partners.length} đối tác đang hoạt động.`,
        );

        const versions = db.getProfileVersions(userId);
        const currentVersionNumber = versions.length;

        console.log(
          `[${timestamp}] [MATCH_RUN] [STEP 4] Chạy thuật toán MatchingService.runBatchMatch...`,
        );
        // Runs matching strictly on the confirmed startup profile stored in Supabase/local DB
        const matches = MatchingService.runBatchMatch(
          startupProfile,
          partners,
          currentVersionNumber,
        );

        let maxScore = 0;
        let minScore = 100;
        if (matches.length > 0) {
          maxScore = Math.max(...matches.map((m) => m.totalScore));
          minScore = Math.min(...matches.map((m) => m.totalScore));
        }

        console.log(
          `[${timestamp}] [MATCH_RUN] [STEP 5] Đã hoàn tất tính toán so khớp. Số kết quả: ${matches.length}, điểm cao nhất: ${maxScore}, thấp nhất: ${minScore}`,
        );

        console.log(
          `[${timestamp}] [MATCH_RUN] [STEP 6] Lưu kết quả so khớp vào bảng match_results thành công cho user: ${userId}`,
        );
        db.saveMatchResults(userId, matches);

        console.log(
          `[${timestamp}] [MATCH_RUN] [STEP 7] Trả response thành công cho frontend.`,
        );
        sendSuccess(res, "Chạy thuật toán so khớp thành công", matches);
      } catch (e: any) {
        console.error(
          `[${timestamp}] [MATCH_RUN] [EXCEPTION] Có lỗi xảy ra trong quá trình chạy so khớp cho user ID: ${userId}:`,
          e,
        );
        sendError(
          res,
          "Chạy so khớp thất bại",
          "MATCH_RUN_FAILED",
          e.stack || e.message,
          500,
        );
      }
    },
  );

  // 23. Matches: Get matches list
  app.get(
    "/api/v1/startup/matches",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user!.id;
      const provider = getPartnerProvider();
      let storedMatches = db.getMatchResults(userId);

      if (!storedMatches || storedMatches.length === 0) {
        const startupProfile = db.getStartupProfile(userId);
        if (startupProfile) {
          const partners = await provider.listActivePartners();
          if (partners && partners.length > 0) {
            const versions = db.getProfileVersions(userId);
            const currentVersionNumber = versions.length;
            const calculatedMatches = MatchingService.runBatchMatch(
              startupProfile,
              partners,
              currentVersionNumber,
            );
            if (calculatedMatches.length > 0) {
              db.saveMatchResults(userId, calculatedMatches);
              storedMatches = calculatedMatches;
            }
          }
        }
      }

      // Join partner info
      const fullMatches = await Promise.all(
        storedMatches.map(async (m) => {
          const p = await provider.getPartnerById(m.partnerId);
          return {
            ...m,
            partner: p || undefined,
          };
        }),
      );

      sendSuccess(res, "Lấy danh sách kết quả so khớp thành công", fullMatches);
    },
  );

  // 24. Matches: Get detailed match
  app.get(
    "/api/v1/startup/matches/:match_id",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const match = db.getMatchById(req.user!.id, req.params.match_id);
      if (!match) {
        return sendError(
          res,
          "Không tìm thấy kết quả so khớp",
          "MATCH_NOT_FOUND",
          "Vui lòng kiểm tra lại match ID.",
          404,
        );
      }

      const provider = getPartnerProvider();
      const partner = await provider.getPartnerById(match.partnerId);

      sendSuccess(res, "Lấy chi tiết so khớp thành công", {
        ...match,
        partner: partner || undefined,
      });
    },
  );

  // 25. Matches: Clear matches list
  app.delete(
    "/api/v1/startup/matches",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      db.clearMatchResults(req.user!.id);
      sendSuccess(res, "Đã xóa tất cả lịch sử so khớp cũ");
    },
  );

  // 26. Connection Requests: Send
  app.post(
    "/api/v1/startup/connections",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const { partnerId, matchId, matchScore, message } = req.body;

      if (!partnerId || !matchId) {
        return sendError(
          res,
          "Dữ liệu yêu cầu kết nối thiếu",
          "INVALID_CONNECTION_PAYLOAD",
          "Trường partnerId và matchId là bắt buộc.",
          400,
        );
      }

      try {
        const provider = getPartnerProvider();
        const partner = await provider.getPartnerById(partnerId);

        const cr = db.createConnectionRequest(req.user!.id, {
          partnerId,
          matchId,
          matchScore: matchScore || 0,
          message: message || "",
        });

        const responseData = {
          ...cr,
          isDemo: partner ? partner.isDemo : false,
          is_demo: partner ? partner.isDemo : false,
        };

        if (partner && partner.isDemo) {
          sendSuccess(
            res,
            "Yêu cầu kết nối thử nghiệm đã được ghi nhận thành công trong môi trường mô phỏng. (Môi trường mô phỏng: Thư giới thiệu đã được lưu nhưng không có email thật nào được gửi đến đối tác demo.)",
            responseData,
            201,
          );
        } else {
          sendSuccess(res, "Gửi yêu cầu kết nối thành công", responseData, 201);
        }
      } catch (e: any) {
        if (e.message === "CONNECTION_ALREADY_EXISTS") {
          sendError(
            res,
            "Yêu cầu kết nối tới đối tác này đã tồn tại",
            "DUPLICATE_CONNECTION",
            "Bạn chỉ có thể gửi một yêu cầu kết nối duy nhất tới mỗi đối tác.",
            409,
          );
        } else {
          sendError(
            res,
            "Gửi yêu cầu kết nối thất bại",
            "CONNECTION_FAILED",
            e.message,
          );
        }
      }
    },
  );

  // 27. Connection Requests: List
  app.get(
    "/api/v1/startup/connections",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const list = db.getConnectionRequests(req.user!.id);
      const provider = getPartnerProvider();

      // Join partner display metadata
      const fullList = await Promise.all(
        list.map(async (cr) => {
          const p = await provider.getPartnerById(cr.partnerId);
          return {
            ...cr,
            partnerName: p?.organizationName || "Đối tác không xác định",
            partnerType: p?.organizationType || "other",
            isDemo: p ? p.isDemo : false,
            is_demo: p ? p.isDemo : false,
          };
        }),
      );

      sendSuccess(res, "Lấy danh sách yêu cầu kết nối thành công", fullList);
    },
  );

  // 28. Connection Requests: Edit message
  app.patch(
    "/api/v1/startup/connections/:connection_id/message",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const { message } = req.body;
      try {
        const updated = db.updateConnectionMessage(
          req.params.connection_id,
          message,
        );
        sendSuccess(res, "Cập nhật thư giới thiệu thành công", updated);
      } catch (e: any) {
        sendError(
          res,
          "Cập nhật thư giới thiệu thất bại",
          "UPDATE_MESSAGE_FAILED",
          e.message,
        );
      }
    },
  );

  // 29. Connection Requests: Cancel
  app.delete(
    "/api/v1/startup/connections/:connection_id",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      try {
        db.cancelConnectionRequest(req.params.connection_id);
        sendSuccess(res, "Hủy yêu cầu kết nối thành công");
      } catch (e: any) {
        sendError(
          res,
          "Hủy yêu cầu kết nối thất bại",
          "CANCEL_CONNECTION_FAILED",
          e.message,
        );
      }
    },
  );

  // 30. Dashboard Analytics summary
  app.get(
    "/api/v1/startup/dashboard",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const profile = db.getStartupProfile(req.user!.id);
      const matches = db.getMatchResults(req.user!.id);
      const connections = db.getConnectionRequests(req.user!.id);

      const provider = getPartnerProvider();
      const highMatches = matches.filter((m) => m.totalScore >= 80);
      const pendingConns = connections.filter((c) => c.status === "pending");
      const acceptedConns = connections.filter((c) => c.status === "accepted");

      // Missing profile fields count
      const missingFields: string[] = [];
      let completion = 0;

      if (profile) {
        const fields = [
          "logoUrl",
          "website",
          "foundingYear",
          "address",
          "industries",
          "technologies",
          "stage",
          "fundingNeed",
          "useOfFunds",
        ];
        let filled = 0;
        fields.forEach((f) => {
          const val = profile[f as keyof StartupProfileDTO];
          if (val && (Array.isArray(val) ? val.length > 0 : true)) {
            filled++;
          } else {
            missingFields.push(f);
          }
        });
        completion = Math.round((filled / fields.length) * 100);
      } else {
        missingFields.push("Hồ sơ startup chưa khởi tạo");
      }

      // Join partner info to recent items
      const recentMatches = await Promise.all(
        matches.slice(0, 3).map(async (m) => {
          const p = await provider.getPartnerById(m.partnerId);
          return { ...m, partner: p || undefined };
        }),
      );

      const recentConnections = await Promise.all(
        connections.slice(0, 3).map(async (c) => {
          const p = await provider.getPartnerById(c.partnerId);
          return {
            ...c,
            partnerName: p?.organizationName || "Đối tác không xác định",
            partnerType: p?.organizationType || "other",
          };
        }),
      );

      sendSuccess(res, "Lấy báo cáo tổng hợp dashboard thành công", {
        startupName: profile?.startupName || null,
        profileStatus: profile ? "completed" : "incomplete",
        profileCompletion: completion,
        hasUnconfirmedDraft: false, // Determined by client stores
        totalMatches: matches.length,
        highMatchCount: highMatches.length,
        pendingConnections: pendingConns.length,
        acceptedConnections: acceptedConns.length,
        recentMatches,
        recentConnections,
        missingFields,
      });
    },
  );

  // 31. Sandbox: Create Simulation
  app.post(
    "/api/v1/startup/sandbox/create",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user!.id;
      const { partnerId } = req.body;

      if (!partnerId) {
        return sendError(
          res,
          "Thiếu thông tin đối tác",
          "INVALID_PARTNER_ID",
          "Vui lòng cung cấp partnerId.",
          400,
        );
      }

      try {
        const provider = getPartnerProvider();
        const partner = await provider.getPartnerById(partnerId);
        const partnerName = partner?.organizationName || "Đối tác ẩn danh";

        // Terminate any active simulation for this user first
        const active = db.getActiveSandbox(userId);
        if (active) {
          active.status = "completed";
          active.updatedAt = new Date().toISOString();
          db.saveSandboxSimulation(active);
        }

        const initialMetrics = {
          cash: 100000,
          revenue: 5000,
          burnRate: 10000,
          runway: 10,
          growthRate: 15,
          productQuality: 75,
          customerSat: 80,
          teamHealth: 85,
          brandRep: 75,
          equity: 100,
        };

        const newSim = {
          id: `sim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          userId,
          partnerId,
          partnerName,
          status: "active" as const,
          currentTurn: 1,
          metrics: initialMetrics,
          decisions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        db.saveSandboxSimulation(newSim);
        sendSuccess(res, "Khởi tạo giả lập Sandbox thành công", newSim, 201);
      } catch (e: any) {
        sendError(
          res,
          "Khởi tạo giả lập thất bại",
          "SANDBOX_CREATE_FAILED",
          e.message,
        );
      }
    },
  );

  // 32. Sandbox: Get Active Simulation
  app.get(
    "/api/v1/startup/sandbox/active",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      try {
        const active = db.getActiveSandbox(req.user!.id);
        if (!active) {
          return sendSuccess(res, "Không có giả lập nào đang chạy", null);
        }
        sendSuccess(
          res,
          "Lấy thông tin giả lập đang hoạt động thành công",
          active,
        );
      } catch (e: any) {
        sendError(
          res,
          "Lấy thông tin giả lập thất bại",
          "SANDBOX_GET_FAILED",
          e.message,
        );
      }
    },
  );

  // 33. Sandbox: Step Decision
  app.post(
    "/api/v1/startup/sandbox/step",
    requireAuth,
    async (req: AuthenticatedRequest, res) => {
      const userId = req.user!.id;
      const { choiceId, customReasoning } = req.body;

      const sim = db.getActiveSandbox(userId);
      if (!sim) {
        return sendError(
          res,
          "Không tìm thấy giả lập đang chạy",
          "ACTIVE_SANDBOX_NOT_FOUND",
          "Vui lòng khởi tạo một thử thách giả lập mới.",
          404,
        );
      }

      try {
        const provider = getPartnerProvider();
        const partner = await provider.getPartnerById(sim.partnerId);
        const isVC =
          partner?.organizationType === "investment_fund" ||
          partner?.organizationType === "investor";

        // Deterministic metric adjustments based on choice and turn
        let title = "";
        let desc = "";
        let metricChanges: any = {};
        let choiceText = "";

        if (sim.currentTurn === 1) {
          title = "Lượt 1: Phân bổ Ngân sách & Xây dựng Đội ngũ ban đầu";
          if (isVC) {
            desc =
              "Nhà đầu tư đã quyết định giải ngân gói hạt giống trị giá $100,000 vốn mồi. Bạn cần lập kế hoạch phân bổ nguồn lực thông minh để chuẩn bị phát triển và ra mắt sản phẩm đầu tiên.";
            if (choiceId === "A") {
              choiceText =
                "Đầu tư mạnh R&D (60% kỹ thuật, 20% marketing, 20% dự phòng)";
              metricChanges = {
                cash: -20000,
                burnRate: 8000,
                teamHealth: 25,
                productQuality: 20,
              };
            } else if (choiceId === "B") {
              choiceText =
                "Đẩy mạnh Marketing (60% ads thu hút tệp chờ, 20% sản phẩm, 20% dự phòng)";
              metricChanges = {
                cash: -35000,
                burnRate: 11000,
                growthRate: 30,
                productQuality: -10,
                revenue: 1500,
              };
            } else {
              choiceText =
                "Tối giản chi phí (Thuê outsource làm MVP, giữ lại 80% ngân sách)";
              metricChanges = {
                cash: -10000,
                burnRate: 3000,
                productQuality: -25,
                brandRep: -10,
              };
            }
          } else {
            desc =
              "Đại diện tập đoàn đối tác đồng ý rót khoản tài trợ thử nghiệm $100,000 để chạy chương trình pilot liên kết hệ thống. Họ yêu cầu bạn thiết lập đội ngũ tích hợp kỹ thuật ngay lập tức.";
            if (choiceId === "A") {
              choiceText =
                "Tuyển 2 kỹ sư phần mềm cao cấp chuyên biệt về tích hợp hệ thống API";
              metricChanges = {
                cash: -25000,
                burnRate: 10000,
                productQuality: 20,
                teamHealth: 20,
              };
            } else if (choiceId === "B") {
              choiceText =
                "Founder tự kiêm kỹ thuật, sử dụng các API thương mại sẵn có tích hợp tạm thời";
              metricChanges = {
                cash: -15000,
                burnRate: 5000,
                productQuality: 10,
                teamHealth: -15,
              };
            } else {
              choiceText =
                "Thuê một agency tích hợp phần mềm bên ngoài thực hiện trọn gói giá rẻ";
              metricChanges = {
                cash: -10000,
                burnRate: 3000,
                productQuality: -20,
                brandRep: -10,
              };
            }
          }
        } else if (sim.currentTurn === 2) {
          title = "Lượt 2: Trải nghiệm khách hàng & Phản hồi thực tế";
          if (isVC) {
            desc =
              "Khách hàng đầu tiên phản hồi rằng sản phẩm của bạn tuy nhiều tính năng nhưng giao diện quá phức tạp và hay gặp lỗi gián đoạn hệ thống. Tỷ lệ khách hàng rời bỏ có dấu hiệu gia tăng.";
            if (choiceId === "A") {
              choiceText =
                "Tập trung tối ưu R&D: Tạm dừng marketing, dồn lực lượng kỹ sư viết lại mã nguồn, tối ưu UI/UX";
              metricChanges = {
                cash: -12000,
                customerSat: 20,
                productQuality: 15,
                growthRate: -5,
              };
            } else if (choiceId === "B") {
              choiceText =
                "Tiếp tục scale người dùng: Tiếp tục marketing thu hút người dùng mới, lỗi sẽ vá dần sau";
              metricChanges = {
                cash: -25000,
                revenue: 2000,
                customerSat: -25,
                productQuality: -15,
              };
            } else {
              choiceText =
                "Ưu đãi xoa dịu: Tặng mã giảm giá 50% cho bất kỳ khách hàng nào phản hồi không tốt";
              metricChanges = { cash: -15000, customerSat: 15, revenue: -1000 };
            }
          } else {
            desc =
              "Trong quá trình chạy thử nghiệm, đội ngũ IT của tập đoàn đối tác phàn nàn rằng tài liệu API của startup bạn viết quá sơ sài, hệ thống phản hồi chậm chạp làm tắc nghẽn giao dịch.";
            if (choiceId === "A") {
              choiceText =
                "Cử Tech Lead sang làm việc trực tiếp tại văn phòng đối tác để viết tài liệu và tối ưu hệ thống";
              metricChanges = {
                cash: -15000,
                customerSat: 25,
                productQuality: 20,
                teamHealth: -10,
              };
            } else if (choiceId === "B") {
              choiceText =
                "Giải thích do môi trường đối tác chưa tối ưu, khuyên đối tác tự nâng cấp hạ tầng mạng nội bộ";
              metricChanges = { customerSat: -20, brandRep: -15 };
            } else {
              choiceText =
                "Đầu tư nâng cấp Cloud cấu hình cực mạnh để tăng tốc phản hồi máy chủ tức thời";
              metricChanges = {
                cash: -20000,
                burnRate: 4000,
                productQuality: 10,
              };
            }
          }
        } else if (sim.currentTurn === 3) {
          title = "Lượt 3: Đối thủ Cạnh tranh & Định vị";
          desc =
            "Một đối thủ cạnh tranh lớn trên thị trường vừa công bố giải pháp tương tự sản phẩm của bạn với giá rẻ hơn 30% nhằm tranh giành thị phần.";
          if (choiceId === "A") {
            choiceText =
              "Nghiên cứu tính năng độc quyền: Phát triển module AI độc bản giải quyết nỗi đau tốt hơn";
            metricChanges = { cash: -20000, productQuality: 20, brandRep: 15 };
          } else if (choiceId === "B") {
            choiceText =
              "Khơi mào cuộc chiến giá: Hạ giá bán xuống 40%, tăng tiền marketing quảng cáo đối đầu";
            metricChanges = {
              cash: -25000,
              burnRate: 5000,
              revenue: -2000,
              growthRate: 15,
            };
          } else {
            choiceText =
              "Định vị phân khúc cao cấp: Giữ nguyên giá trị sản phẩm, tập trung truyền thông chất lượng vượt trội";
            metricChanges = { brandRep: 15, customerSat: 15, growthRate: -5 };
          }
        } else if (sim.currentTurn === 4) {
          title = "Lượt 4: Quản trị Khủng hoảng tài chính";
          desc =
            "Thị trường tài chính toàn cầu thắt chặt. Chi phí vận hành gia tăng đột biến 20% và nhà đầu tư tiếp theo đang tạm dừng giải ngân vòng gọi vốn mới.";
          if (choiceId === "A") {
            choiceText =
              "Cắt giảm nhân sự sống sót: Sa thải 30% nhân viên không cốt lõi, chuyển văn phòng nhỏ hơn";
            metricChanges = {
              cash: 20000,
              burnRate: -4000,
              teamHealth: -20,
              productQuality: -10,
              runway: 4,
            };
          } else if (choiceId === "B") {
            choiceText =
              "Định giá giảm (Down-round): Nhận một khoản tài trợ khẩn cấp chấp nhận mất đi 15% cổ phần sáng lập";
            metricChanges = { cash: 50000, equity: -15, runway: 6 };
          } else {
            choiceText =
              "Chơi tất tay: Giữ nguyên chi phí cũ, duy trì động lực, kỳ vọng thị trường sớm ấm lên";
            metricChanges = { cash: -30000, runway: -2, teamHealth: 10 };
          }
        }

        // Apply changes to metrics
        const newMetrics = { ...sim.metrics };
        Object.keys(metricChanges).forEach((k) => {
          const key = k as keyof SimulationMetrics;
          newMetrics[key] = Math.max(
            0,
            newMetrics[key] + (metricChanges[key] || 0),
          );
        });

        // Recalculate Runway: cash / burnRate (clamped min 0)
        newMetrics.runway = Math.round(
          newMetrics.cash / Math.max(1000, newMetrics.burnRate),
        );
        if (metricChanges.runway) {
          newMetrics.runway = Math.max(
            0,
            newMetrics.runway + metricChanges.runway,
          );
        }

        sim.decisions.push({
          turn: sim.currentTurn,
          scenarioTitle: title,
          scenarioDescription: desc,
          choiceSelected: choiceText,
          customReasoning: customReasoning || "",
          metricChanges,
        });

        sim.metrics = newMetrics;
        sim.currentTurn += 1;
        sim.updatedAt = new Date().toISOString();

        db.saveSandboxSimulation(sim);
        sendSuccess(res, "Nộp quyết định lượt chơi thành công", sim);
      } catch (e: any) {
        sendError(
          res,
          "Nộp quyết định thất bại",
          "SANDBOX_STEP_FAILED",
          e.message,
        );
      }
    },
  );

  // 34. Sandbox: Complete and Generate Report
  app.post(
    "/api/v1/startup/sandbox/complete",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const userId = req.user!.id;
      const sim = db.getActiveSandbox(userId);

      if (!sim) {
        return sendError(
          res,
          "Không tìm thấy giả lập đang chạy",
          "ACTIVE_SANDBOX_NOT_FOUND",
          "Vui lòng khởi tạo một thử thách giả lập mới.",
          404,
        );
      }

      try {
        // Calculate competency scores based on metrics and decisions
        let cashMgmt = 70;
        if (sim.metrics.cash > 50000) cashMgmt += 20;
        if (sim.metrics.cash < 20000) cashMgmt -= 30;
        if (sim.metrics.runway > 5) cashMgmt += 10;

        let resAlloc = 75;
        const turn1Choice = sim.decisions.find((d) => d.turn === 1);
        if (
          turn1Choice?.choiceSelected.includes("R&D") ||
          turn1Choice?.choiceSelected.includes("kỹ sư")
        ) {
          resAlloc += 15;
        } else if (
          turn1Choice?.choiceSelected.includes("outsource") ||
          turn1Choice?.choiceSelected.includes("agency")
        ) {
          resAlloc -= 25;
        }

        let custUnder = Math.round(sim.metrics.customerSat);
        let prodDev = Math.round(sim.metrics.productQuality);
        let teamMgmt = Math.round(sim.metrics.teamHealth);

        let crisisHand = 70;
        const turn4Choice = sim.decisions.find((d) => d.turn === 4);
        if (turn4Choice?.choiceSelected.includes("Cắt giảm")) {
          crisisHand += 20;
        } else if (turn4Choice?.choiceSelected.includes("Down-round")) {
          crisisHand += 15;
        } else {
          crisisHand -= 25;
        }

        let adapt = 70;
        const turn3Choice = sim.decisions.find((d) => d.turn === 3);
        if (
          turn3Choice?.choiceSelected.includes("AI độc bản") ||
          turn3Choice?.choiceSelected.includes("cao cấp")
        ) {
          adapt += 20;
        } else {
          adapt -= 15;
        }

        // Clamp competencies between 20 and 100
        const competencies = {
          cashManagement: Math.max(20, Math.min(100, cashMgmt)),
          resourceAllocation: Math.max(20, Math.min(100, resAlloc)),
          customerUnderstanding: Math.max(20, Math.min(100, custUnder)),
          productDevelopment: Math.max(20, Math.min(100, prodDev)),
          teamManagement: Math.max(20, Math.min(100, teamMgmt)),
          crisisHandling: Math.max(20, Math.min(100, crisisHand)),
          adaptability: Math.max(20, Math.min(100, adapt)),
        };

        const performanceScore = Math.round(
          (competencies.cashManagement +
            competencies.resourceAllocation +
            competencies.customerUnderstanding +
            competencies.productDevelopment +
            competencies.teamManagement +
            competencies.crisisHandling +
            competencies.adaptability) /
            7,
        );

        // Overall Assessment
        let overall = "";
        if (performanceScore >= 80) {
          overall =
            "Founder thể hiện tư duy quản trị xuất sắc, phân bổ nguồn lực cân bằng giữa R&D sản phẩm và tăng trưởng người dùng, đồng thời đưa ra các giải pháp dũng cảm để sống sót qua khủng hoảng.";
        } else if (performanceScore >= 60) {
          overall =
            "Founder có tiềm năng tốt, tuy nhiên kỹ năng cân đối ngân sách và dòng tiền trong các tình huống cạnh tranh khốc liệt cần được cải thiện để kéo dài tối đa runway sống sót.";
        } else {
          overall =
            "Cần cải thiện đáng kể năng lực hoạch định tài chính và quản trị nhân sự. Founder có xu hướng đưa ra các quyết định cảm tính hoặc trì hoãn cắt giảm chi phí khi đối mặt với khủng hoảng.";
        }

        // Audit Questions
        const auditQuestions: string[] = [];
        if (sim.metrics.cash < 25000) {
          auditQuestions.push(
            "Tại sao bạn lựa chọn đầu tư mạnh tay cho các hoạt động tăng trưởng khi chưa tối ưu hóa chỉ số lưu giữ người dùng?",
          );
        }
        if (sim.metrics.productQuality < 65) {
          auditQuestions.push(
            "Làm thế nào bạn định giải quyết triệt để các vấn đề lỗi kỹ thuật API khi đối tác doanh nghiệp bắt đầu tích hợp diện rộng?",
          );
        }
        if (sim.metrics.equity < 90) {
          auditQuestions.push(
            "Việc chấp nhận bán đi quá nhiều cổ phần sáng lập ở vòng hạt giống hạt bụi có ảnh hưởng đến động lực kiểm soát lâu dài không?",
          );
        }
        if (auditQuestions.length === 0) {
          auditQuestions.push(
            "Kế hoạch dự phòng của bạn thế nào nếu thời gian tích hợp thực tế với doanh nghiệp kéo dài gấp đôi?",
          );
        }

        sim.status = "completed";
        sim.report = {
          performanceScore,
          competencies,
          keyDecisionsSummary: `Founder đã chơi hết 4 lượt chơi. Lựa chọn nổi bật bao gồm việc phân bổ nguồn vốn ảo $100k ban đầu, xử lý phản hồi IT, đối phó đối thủ giảm giá và đưa ra quyết định cắt giảm để chống chọi khủng hoảng.`,
          investorAuditQuestions: auditQuestions,
          overallAssessment: overall,
        };
        sim.updatedAt = new Date().toISOString();

        db.saveSandboxSimulation(sim);
        sendSuccess(res, "Hoàn thành giả lập Sandbox thành công", sim);
      } catch (e: any) {
        sendError(
          res,
          "Hoàn thành giả lập thất bại",
          "SANDBOX_COMPLETE_FAILED",
          e.message,
        );
      }
    },
  );

  // 35. Sandbox: Investor Action
  app.post(
    "/api/v1/startup/sandbox/investor-action",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const userId = req.user!.id;
      const { simId, action, meetingDetails } = req.body;

      if (!simId || !action) {
        return sendError(
          res,
          "Thiếu thông tin yêu cầu",
          "INVALID_INVESTOR_ACTION_PAYLOAD",
          "Trường simId và action là bắt buộc.",
          400,
        );
      }

      try {
        const store = db["store"];
        const sim = store.sandboxSimulations.find(
          (s: any) => s.id === simId && s.userId === userId,
        );
        if (!sim) {
          return sendError(
            res,
            "Không tìm thấy bản ghi giả lập",
            "SIMULATION_NOT_FOUND",
            "Vui lòng kiểm tra lại simId.",
            404,
          );
        }

        sim.investorAction = action;
        if (action === "scheduled_meeting" && meetingDetails) {
          sim.meetingDetails = {
            time:
              meetingDetails.time ||
              new Date(Date.now() + 86400000 * 2).toISOString(), // default 2 days later
            platform: meetingDetails.platform || "google_meet",
            link: meetingDetails.link || "https://meet.google.com/abc-defg-hij",
            notes:
              meetingDetails.notes ||
              "Thảo luận kế hoạch thẩm định chi tiết sản phẩm.",
          };
        } else {
          sim.meetingDetails = null;
        }
        sim.updatedAt = new Date().toISOString();

        db.saveSandboxSimulation(sim);
        sendSuccess(res, "Cập nhật quyết định nhà đầu tư thành công", sim);
      } catch (e: any) {
        sendError(
          res,
          "Cập nhật quyết định nhà đầu tư thất bại",
          "INVESTOR_ACTION_FAILED",
          e.message,
        );
      }
    },
  );


  // Health for Next.js mount
  app.get("/api/v1/health", (_req, res) => {
    res.json({ success: true, message: "deal-flow ok", data: { service: "deal-flow" } });
  });

  return app;
}
