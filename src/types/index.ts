export type ItemStatus = "available" | "pending" | "sold";
export type ContactMethod = "email" | "phone" | "app_message";
export type IntentStatus = "submitted" | "reviewed" | "accepted" | "declined";

// TODO: Extend with co-seller/admin roles in future versions
export type UserRole = "guest" | "buyer" | "seller";
