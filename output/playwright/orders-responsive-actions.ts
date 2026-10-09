export type OrderActionState = { status?: string; message?: string };
export async function updateOrderRequestQuantityWithStateAction(state: OrderActionState) { return state; }
export async function updateOrderRequestSupplierWithStateAction(state: OrderActionState) { return state; }
export async function updateOrderRequestStatusWithStateAction(state: OrderActionState) { return state; }
export async function receiveOrderRequestWithStateAction(state: OrderActionState) { return state; }
export async function revertOrderReceiptWithStateAction(state: OrderActionState) { return state; }
