const ALLOWED_LEVELS = ["info", "success", "warning", "critical"];

export class DashboardNotifications {
  constructor() {
    this.notifications = [];
    this.listeners = new Set();
    this.nextId = 1;
  }

  add({ title, message, level = "info" }) {
    if (!ALLOWED_LEVELS.includes(level)) {
      level = "info";
    }

    const notification = {
      id: this.nextId++,
      title,
      message,
      level,
      createdAt: new Date().toISOString(),
      read: false
    };

    this.notifications.unshift(notification);
    this.notify();
    return notification;
  }

  markRead(id) {
    this.notifications = this.notifications.map(item =>
      item.id === id ? { ...item, read: true } : item
    );
    this.notify();
  }

  markAllRead() {
    this.notifications = this.notifications.map(item => ({
      ...item,
      read: true
    }));
    this.notify();
  }

  dismiss(id) {
    this.notifications = this.notifications.filter(
      item => item.id !== id
    );
    this.notify();
  }

  clear() {
    this.notifications = [];
    this.notify();
  }

  getSnapshot() {
    return {
      notifications: [...this.notifications],
      unreadCount: this.notifications.filter(item => !item.read).length
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export const luxNotifications = new DashboardNotifications();
