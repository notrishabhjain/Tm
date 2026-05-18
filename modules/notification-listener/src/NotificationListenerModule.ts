import { requireNativeModule, EventEmitter } from 'expo-modules-core';
import type {
  NotificationData,
  PersistentNotificationParams,
  PermissionStatus,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NativeModule = requireNativeModule<any>('NotificationListener');
const emitter = new EventEmitter(NativeModule as Parameters<typeof EventEmitter>[0]);

const NotificationListenerModule = {
  getPermissionStatus(): Promise<PermissionStatus> {
    return NativeModule.getPermissionStatus() as Promise<PermissionStatus>;
  },

  openPermissionSettings(): Promise<void> {
    return NativeModule.openPermissionSettings() as Promise<void>;
  },

  startService(): Promise<void> {
    return NativeModule.startService() as Promise<void>;
  },

  stopService(): Promise<void> {
    return NativeModule.stopService() as Promise<void>;
  },

  isServiceRunning(): Promise<boolean> {
    return NativeModule.isServiceRunning() as Promise<boolean>;
  },

  setMonitoredApps(packageNames: string[]): Promise<void> {
    return NativeModule.setMonitoredApps(packageNames) as Promise<void>;
  },

  getMonitoredApps(): Promise<string[]> {
    return NativeModule.getMonitoredApps() as Promise<string[]>;
  },

  updatePersistentNotification(params: PersistentNotificationParams): Promise<void> {
    return NativeModule.updatePersistentNotification(params) as Promise<void>;
  },

  hidePersistentNotification(): Promise<void> {
    return NativeModule.hidePersistentNotification() as Promise<void>;
  },

  addNotificationListener(listener: (data: NotificationData) => void) {
    return emitter.addListener('onNotification', listener);
  },

  addQuickActionDoneTopListener(listener: () => void) {
    return emitter.addListener('onQuickActionDoneTop', listener);
  },

  addQuickActionOpenListener(listener: () => void) {
    return emitter.addListener('onQuickActionOpen', listener);
  },
};

export default NotificationListenerModule;
