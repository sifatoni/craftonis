import { z } from 'zod';

export const ExperienceSchema = z.object({
  company: z.string().default('Unknown'),
  role: z.string().default('Unknown'),
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default('Present'),
  tenureMonths: z.preprocess((val) => {
    if (val === null || val === undefined) return 0;
    const num = typeof val === 'string' ? Number(val) : val;
    if (typeof num !== 'number' || isNaN(num) || num < 0) return 0;
    return Math.floor(num);
  }, z.number().int().nonnegative().default(0)),
  description: z.string().default(''),
});

export const EducationSchema = z.object({
  degree: z.string().default('Unknown'),
  institution: z.string().default('Unknown'),
  year: z.number().int().nonnegative().default(0),
  level: z.enum(['MASTER', 'BACHELOR', 'HIGH_SCHOOL', 'OTHER']).default('OTHER'),
  result: z.string().nullable().default(null),
});

export const PersonalDetailsSchema = z.object({
  dateOfBirth: z.string().nullable().default(null),
  gender: z.string().nullable().default(null),
  nationality: z.string().nullable().default(null),
  religion: z.string().nullable().default(null),
  maritalStatus: z.string().nullable().default(null),
  nationalId: z.string().nullable().default(null),
});

export const CvParsedDataSchema = z.object({
  name: z.string().min(1).default('Candidate'),
  email: z.string().email().nullable().or(z.string().length(0)).default(null),
  phone: z.string().nullable().default(null),
  secondaryPhone: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  linkedinUrl: z.string().url().nullable().or(z.string().length(0)).default(null),
  summary: z.string().default(''),
  skills: z.array(z.string()).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  personalDetails: PersonalDetailsSchema.default({
    dateOfBirth: null,
    gender: null,
    nationality: null,
    religion: null,
    maritalStatus: null,
    nationalId: null,
  }),
  totalYearsExperience: z.number().nonnegative().default(0),
  currentRole: z.string().nullable().default(null),
  currentCompany: z.string().nullable().default(null),
});

export type CvParsedData = z.infer<typeof CvParsedDataSchema>;

/**
 * Normalizes common AI parsing quirks
 */
export function normalizeCvData(data: any): any {
  if (!data || typeof data !== 'object') return {};

  const cleanValue = (val: any) => {
    if (val === 'null' || val === 'undefined' || val === 'N/A' || val === 'None') return null;
    return val;
  };

  const normalized: any = { ...data };

  // Handle strings that should be null
  Object.keys(normalized).forEach(key => {
    normalized[key] = cleanValue(normalized[key]);
  });

  // Normalize arrays
  if (!Array.isArray(normalized.skills)) normalized.skills = [];
  if (!Array.isArray(normalized.experience)) normalized.experience = [];
  if (!Array.isArray(normalized.education)) normalized.education = [];
  if (!Array.isArray(normalized.certifications)) normalized.certifications = [];
  if (!Array.isArray(normalized.languages)) normalized.languages = [];
  if (!Array.isArray(normalized.achievements)) normalized.achievements = [];

  // Normalize objects
  if (typeof normalized.personalDetails !== 'object' || normalized.personalDetails === null) {
    normalized.personalDetails = {};
  } else {
    Object.keys(normalized.personalDetails).forEach(key => {
      normalized.personalDetails[key] = cleanValue(normalized.personalDetails[key]);
    });
  }

  // Sanitize URLs
  if (normalized.linkedinUrl && !normalized.linkedinUrl.startsWith('http')) {
    normalized.linkedinUrl = null;
  }

  return normalized;
}
