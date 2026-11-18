export type Lang = 'bn' | 'en';
export type Role = 'owner' | 'staff';
export type Kind =
  | 'firms'
  | 'staff'
  | 'expense_heads'
  | 'programs'
  | 'dispatches'
  | 'expenses'
  | 'money_movements'
  | 'bills'
  | 'settlements'
  | 'supplementary_receipts';
export const kinds: Kind[] = [
  'firms',
  'staff',
  'expense_heads',
  'programs',
  'dispatches',
  'expenses',
  'money_movements',
  'bills',
  'settlements',
  'supplementary_receipts',
];
export type Data = Record<string, string | number | boolean | null | string[] | Data[]>;
export interface Row {
  id: string;
  org_id: string;
  data: Data;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}
export type Store = Record<Kind, Row[]>;
export interface Workspace {
  org_id: string;
  user_id: string;
  role: Role;
  staff_id: string | null;
  name: string;
  email: string;
}
export interface Operation {
  id: string;
  kind: Kind;
  record_id: string;
  data: Data;
  expected_version: number;
  reason: string;
  status: 'pending' | 'conflict';
  error?: string;
}
export const emptyStore = (): Store =>
  Object.fromEntries(kinds.map((k) => [k, []])) as unknown as Store;
export const str = (v: unknown) => (v == null ? '' : String(v));
export const num = (v: unknown) => Number(v) || 0;
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const uid = () => crypto.randomUUID();
