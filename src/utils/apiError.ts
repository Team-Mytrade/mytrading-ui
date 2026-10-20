// Services prefix field errors with the field ("accountCode: Account code 1000 is already used")
const FIELD_PREFIX = /^([a-z][A-Za-z0-9]*): (.+)$/s;

// The message to show for a failed API call, in the services' error format {status, error, message, fieldErrors}.
export const apiError = (err: any, fallback: string): string => {
  const message: string = err?.response?.data?.message || err?.response?.data?.error || "";
  if (message) return FIELD_PREFIX.exec(message)?.[2] ?? message;
  // A refusal without a message (e.g. from the gateway) is still a permission problem, not a failed save
  return err?.response?.status === 403 ? "You don't have permission for this action. Ask your administrator for access." : fallback;
};

// Field name -> message from a 400 response, for showing errors under form fields
export const apiFieldErrors = (err: any): Record<string, string> => {
  const fieldErrors = err?.response?.data?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") return fieldErrors as Record<string, string>;
  // "field: message" errors thrown by services without a fieldErrors map
  const match = FIELD_PREFIX.exec(String(err?.response?.data?.message ?? ""));
  return match ? { [match[1]]: match[2] } : {};
};
