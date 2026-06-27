const SESSION_EXPIRED_REDIRECT_KEY = "sessionExpiredRedirect";
const SESSION_EXPIRED_FLAG_KEY = "sessionExpiredFlag";
const SESSION_EXPIRED_DRAFTS_KEY = "sessionExpiredDrafts";

type BaseDraftField = {
  key: string;
  tagName: string;
};

type CheckboxDraftField = BaseDraftField & {
  inputType: "checkbox";
  value: boolean;
};

type RadioDraftField = BaseDraftField & {
  inputType: "radio";
  value: string;
};

type MultiSelectDraftField = BaseDraftField & {
  tagName: "select";
  inputType?: undefined;
  value: string[];
};

type ValueDraftField = BaseDraftField & {
  inputType?: string;
  value: string;
};

type DraftField =
  | CheckboxDraftField
  | RadioDraftField
  | MultiSelectDraftField
  | ValueDraftField;

type PageDraft = {
  path: string;
  savedAt: number;
  fields: DraftField[];
};

const isDraftField = (field: DraftField | null): field is DraftField =>
  field !== null;

export const getCurrentAppLocation = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const saveSessionExpiredRedirect = (path = getCurrentAppLocation()) => {
  localStorage.setItem(SESSION_EXPIRED_REDIRECT_KEY, path);
  localStorage.setItem(SESSION_EXPIRED_FLAG_KEY, "true");
};

export const getSessionExpiredRedirect = () =>
  localStorage.getItem(SESSION_EXPIRED_REDIRECT_KEY);

export const clearSessionExpiredRedirect = () => {
  localStorage.removeItem(SESSION_EXPIRED_REDIRECT_KEY);
  localStorage.removeItem(SESSION_EXPIRED_FLAG_KEY);
};

export const clearSessionExpiredFlag = () => {
  localStorage.removeItem(SESSION_EXPIRED_FLAG_KEY);
};

export const hasSessionExpiredFlag = () =>
  localStorage.getItem(SESSION_EXPIRED_FLAG_KEY) === "true";

const getSessionDraftStore = (): Record<string, PageDraft> => {
  try {
    const raw = localStorage.getItem(SESSION_EXPIRED_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Error reading session draft store", error);
    return {};
  }
};

const setSessionDraftStore = (store: Record<string, PageDraft>) => {
  localStorage.setItem(SESSION_EXPIRED_DRAFTS_KEY, JSON.stringify(store));
};

const getElementDraftKey = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
) => {
  const namedKey = element.name?.trim();
  if (namedKey) return namedKey;

  const idKey = element.id?.trim();
  if (idKey) return `#${idKey}`;

  return null;
};

const cssEscapeValue = (value: string) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
};

const setNativeValue = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;

  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
};

const setNativeChecked = (element: HTMLInputElement, checked: boolean) => {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "checked"
  );
  descriptor?.set?.call(element, checked);
};

export const saveSessionExpiredDraft = (path = getCurrentAppLocation()) => {
  try {
    const elements = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select"
      )
    );

    const fields: DraftField[] = elements
      .map((element) => {
        const key = getElementDraftKey(element);
        if (!key || element.disabled) return null;

        if (element instanceof HTMLInputElement) {
          if (
            ["password", "hidden", "submit", "button", "reset", "file"].includes(
              element.type
            )
          ) {
            return null;
          }

          if (element.type === "checkbox") {
            return {
              key,
              tagName: "input",
              inputType: element.type,
              value: element.checked,
            } satisfies DraftField;
          }

          if (element.type === "radio") {
            return {
              key,
              tagName: "input",
              inputType: element.type,
              value: element.checked ? element.value : "",
            } satisfies DraftField;
          }
        }

        if (element instanceof HTMLSelectElement && element.multiple) {
          return {
            key,
            tagName: "select",
            value: Array.from(element.selectedOptions).map((option) => option.value),
          } satisfies DraftField;
        }

        return {
          key,
          tagName: element.tagName.toLowerCase(),
          inputType: element instanceof HTMLInputElement ? element.type : undefined,
          value: element.value,
        } satisfies DraftField;
      })
      .filter(isDraftField)
      .filter((field) => {
        if (field.inputType === "radio") {
          return field.value !== "";
        }
        if (Array.isArray(field.value)) {
          return field.value.length > 0;
        }
        if (typeof field.value === "boolean") {
          return true;
        }
        return field.value.trim() !== "";
      });

    if (fields.length === 0) {
      return;
    }

    const store = getSessionDraftStore();
    store[path] = {
      path,
      savedAt: Date.now(),
      fields,
    };
    setSessionDraftStore(store);
  } catch (error) {
    console.error("Error saving session expired draft", error);
  }
};

export const clearSessionExpiredDraft = (path?: string) => {
  if (!path) {
    localStorage.removeItem(SESSION_EXPIRED_DRAFTS_KEY);
    return;
  }

  const store = getSessionDraftStore();
  delete store[path];

  if (Object.keys(store).length === 0) {
    localStorage.removeItem(SESSION_EXPIRED_DRAFTS_KEY);
    return;
  }

  setSessionDraftStore(store);
};

export const restoreSessionExpiredDraft = (
  path = getCurrentAppLocation(),
  attempt = 0
) => {
  const store = getSessionDraftStore();
  const draft = store[path];

  if (!draft) {
    return;
  }

  let appliedCount = 0;

  draft.fields.forEach((field) => {
    const selector = field.key.startsWith("#")
      ? `#${cssEscapeValue(field.key.slice(1))}`
      : `[name="${cssEscapeValue(field.key)}"]`;

    const matchedElements = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        selector
      )
    );

    if (matchedElements.length === 0) {
      return;
    }

    if (field.inputType === "radio") {
      matchedElements.forEach((element) => {
        if (!(element instanceof HTMLInputElement)) return;
        setNativeChecked(element, element.value === field.value);
        element.dispatchEvent(new Event("change", { bubbles: true }));
      });
      appliedCount += 1;
      return;
    }

    matchedElements.forEach((element) => {
      if (element instanceof HTMLInputElement && field.inputType === "checkbox") {
        setNativeChecked(element, Boolean(field.value));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        appliedCount += 1;
        return;
      }

        const { value } = field;

        if (element instanceof HTMLSelectElement && Array.isArray(value)) {
          Array.from(element.options).forEach((option) => {
            option.selected = value.includes(option.value);
          });
          element.dispatchEvent(new Event("change", { bubbles: true }));
          appliedCount += 1;
          return;
        }

      setNativeValue(element, String(value));
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      appliedCount += 1;
    });
  });

  if (appliedCount > 0) {
    clearSessionExpiredDraft(path);
    return;
  }

  if (attempt >= 10) {
    return;
  }

  window.setTimeout(() => restoreSessionExpiredDraft(path, attempt + 1), 250);
};

export const isSessionExpiredResponse = (
  status?: number,
  message?: string | null
) => {
  const normalizedMessage = (message || "").toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    normalizedMessage.includes("token expired") ||
    normalizedMessage.includes("jwt expired") ||
    normalizedMessage.includes("session expired") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("invalid token")
  );
};
