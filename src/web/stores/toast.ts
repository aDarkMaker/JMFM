import {create} from 'zustand';

export type ToastType = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onPress(): void;
}

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastState {
  items: ToastItem[];
  show(message: string, type?: ToastType, action?: ToastAction): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  show: (message, type = 'info', action) =>
    set((state) => ({items: [...state.items, {id: nextId++, message, type, action}]})),
  dismiss: (id) => set((state) => ({items: state.items.filter((t) => t.id !== id)})),
}));

export function showToast(message: string, type: ToastType = 'info', action?: ToastAction): void {
  useToastStore.getState().show(message, type, action);
}
