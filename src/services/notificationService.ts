// === Notification Service (Pub/Sub Pattern) ===
// This file acts as a simple global event bus for notifications.
// It allows any part of the app to trigger a notification without needing
// direct access to the UI components that display it.

export interface AppNotification {
  id: string;
  title: string;
  message?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

// Listeners represent functions that will be called when a notification happens.
type Listener = (notification: AppNotification) => void;
let listeners: Listener[] = [];

// Components call this to listen for new notifications.
// It returns an "unsubscribe" function to clean up when the component is destroyed.
export const subscribeToNotifications = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
};

// Any logic or component calls this function to broadcast a notification.
export const triggerNotification = (title: string, options?: { body?: string, type?: 'info' | 'success' | 'warning' | 'error', duration?: number }) => {
  const notification: AppNotification = {
    id: Math.random().toString(36).substring(2, 10), // Generate a unique ID
    title,
    message: options?.body,
    type: options?.type || 'info',
    duration: options?.duration || 5000,
  };
  // Call all the registered listener functions
  listeners.forEach(l => l(notification));
};

