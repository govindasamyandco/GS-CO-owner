// Modern Toast Notification Dispatcher

class ToastManager {
  constructor() {
    this.listeners = new Set();
    this.confirmListeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeConfirm(listener) {
    this.confirmListeners.add(listener);
    return () => this.confirmListeners.delete(listener);
  }

  notify(toast) {
    this.listeners.forEach((fn) => fn(toast));
  }

  success(message, title = 'Success') {
    this.notify({ id: Date.now() + Math.random(), type: 'success', title, message, duration: 4000 });
  }

  error(message, title = 'Error') {
    this.notify({ id: Date.now() + Math.random(), type: 'error', title, message, duration: 5000 });
  }

  warning(message, title = 'Warning') {
    this.notify({ id: Date.now() + Math.random(), type: 'warning', title, message, duration: 4500 });
  }

  info(message, title = 'Notice') {
    this.notify({ id: Date.now() + Math.random(), type: 'info', title, message, duration: 4000 });
  }

  // Modern Confirmation Modal Trigger
  confirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger', onConfirm }) {
    this.confirmListeners.forEach((fn) =>
      fn({
        isOpen: true,
        title,
        message,
        confirmText,
        cancelText,
        type,
        onConfirm
      })
    );
  }
}

export const toast = new ToastManager();
