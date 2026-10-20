/** Business kind as the wizard stores it (prototype draft values). */
export type DraftBusinessType = 'product' | 'service';

/** Checklist keys on the done screen. */
export type TodoKey = 'first' | 'logo' | 'team' | 'share';

/**
 * The onboarding draft, persisted as raw JSON under localStorage `vb-biz2` (same shape as
 * the prototype). `cat` is an onboarding category id; `district` is the district name.
 */
export interface BusinessDraft {
  type: DraftBusinessType | '';
  name: string;
  cat: string;
  district: string;
  street: string;
  /** Map pin from step 2 (GPS, map or search), or null when typed only. */
  lat?: number | null;
  lng?: number | null;
  phone: string;
  /** "HH:MM", 24h. */
  open: string;
  close: string;
  sunday: boolean;
  bakong: string;
  /** Data URL of the ID photo, or null. */
  idPhoto: string | null;
  step: WizardStep;
  done: boolean;
  verified: boolean;
  todo: Partial<Record<TodoKey, boolean>>;
  /** Id of the business created when the shop opened (set on the done screen). */
  createdId?: string;
  /**
   * The account that started the draft. The draft is stored per browser, so a draft from
   * someone else who signed in here (or one saved before this field existed) is not resumed.
   */
  ownerId?: string;
}

export type WizardStep = 1 | 2 | 3;

/** Field-level problems from `checkStep`; the component maps them to messages. */
export type DraftProblem = 'type' | 'name' | 'cat' | 'street' | 'phone' | 'bakong' | 'id';
