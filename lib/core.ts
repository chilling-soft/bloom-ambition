// Sensor core: pure logic shared by every surface (mock browser today, extension later).
// Sensitive-field and denylist rules live here in code, never in the model.

export type FieldInfo = {
  el: HTMLInputElement | HTMLTextAreaElement;
  key: string | null; // fact key to fill, or null
  sensitive: boolean; // never read, never learned, never filled
  freeText: boolean; // needs a generated draft
  label: string;
};

const SENSITIVE_TOKENS = new Set([
  "new-password",
  "current-password",
  "cc-number",
  "cc-csc",
  "cc-exp",
  "one-time-code",
]);

// 1) autocomplete tokens, 2) label heuristics, 3) otherwise free text / unknown
const TOKEN_KEY: Record<string, string> = {
  name: "name",
  "given-name": "name",
  email: "email",
  "street-address": "address",
  "address-line1": "address",
  organization: "affiliation",
};

const LABEL_RULES: [RegExp, string][] = [
  [/이메일|e-?mail/i, "email"],
  [/소속|affiliation|organization/i, "affiliation"],
  [/주소|address/i, "address"],
  [/이름|\bname\b/i, "name"],
];

export const isDeniedHost = (host: string) => /bank|pay|wallet|card/i.test(host);

function labelOf(el: HTMLElement): string {
  const id = el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent;
  return (id || el.closest("label")?.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "")
    .trim()
    .replace(/\s+/g, " ");
}

export function collectFields(form: HTMLElement): FieldInfo[] {
  const els = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  const out: FieldInfo[] = [];
  els.forEach((el) => {
    const type = (el as HTMLInputElement).type;
    if (["hidden", "submit", "button", "checkbox", "radio"].includes(type)) return;
    const ac = (el.getAttribute("autocomplete") || "").split(" ").pop() || "";
    const label = labelOf(el);
    const sensitive = type === "password" || SENSITIVE_TOKENS.has(ac);
    let key: string | null = TOKEN_KEY[ac] ?? null;
    if (!key && !sensitive) key = LABEL_RULES.find(([re]) => re.test(label))?.[1] ?? null;
    out.push({ el, key, sensitive, freeText: !sensitive && !key && el.tagName === "TEXTAREA", label });
  });
  return out;
}

// React-controlled inputs ignore plain .value writes; use the native setter and fire input.
export function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
