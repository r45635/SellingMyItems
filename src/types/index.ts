export type ItemStatus = "available" | "pending" | "sold";
export type ContactMethod = "email" | "phone" | "app_message";
export type IntentStatus = "submitted" | "reviewed" | "accepted" | "declined";

// Re-export from auth module for backward compatibility
export type { UserRole } from "@/lib/auth";
