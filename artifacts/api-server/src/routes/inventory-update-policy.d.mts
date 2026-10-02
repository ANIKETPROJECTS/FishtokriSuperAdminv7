export type InventoryUpdateAction =
  | "restore"
  | "skip"
  | "deduct"
  | "reconcile"
  | "unchanged";

export interface InventoryUpdatePolicyInput {
  baselineProtected: boolean;
  wasDeducted: boolean;
  wasActive: boolean;
  wantsDeducted: boolean;
}

export declare function getInventoryUpdateAction(
  input: InventoryUpdatePolicyInput,
): InventoryUpdateAction;