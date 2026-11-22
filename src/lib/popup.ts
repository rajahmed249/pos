export interface CenterPopupPayload {
  type: 'error' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  confirmLabel?: string;
}

export const POPUP_EVENT_NAME = 'pos:center-popup';

export function showCenterPopup(payload: CenterPopupPayload) {
  window.dispatchEvent(new CustomEvent<CenterPopupPayload>(POPUP_EVENT_NAME, { detail: payload }));
}
