import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (obj.constructor && obj.constructor.name !== 'Object' && !Array.isArray(obj)) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as any;
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      result[key] = removeUndefined(val);
    }
  }
  return result;
}

export function toValidDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : val;
  }
  if (typeof val?.toDate === 'function') {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  }
  if (typeof val?.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  try {
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
}

export function safeIsoString(val: any): string {
  return toValidDate(val).toISOString();
}


