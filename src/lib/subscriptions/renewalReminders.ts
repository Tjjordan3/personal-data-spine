import type { PluginListener } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  onAction,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { listItems } from "../db/items";
import { todayKey } from "../db/dates";
import { loadSettings, saveSettings } from "../settings";
import {
  isRenewalDueForReminder,
  renewalDateKey,
  renewalNotificationBody,
  renewalNotifyDedupeKey,
} from "./renewals";

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

export async function checkSubscriptionRenewalReminders(): Promise<void> {
  if (!isTauriRuntime()) return;

  const settings = loadSettings();
  if (!settings.subscriptionRenewalReminders) return;

  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }
  if (!permissionGranted) return;

  const today = todayKey();
  const items = await listItems({
    type: "subscription",
    status: "active",
    limit: 500,
  });
  const notified = { ...(settings.subscriptionRenewalNotified ?? {}) };
  let dirty = false;

  for (const item of items) {
    const renewalKey = renewalDateKey(item);
    if (!renewalKey || !isRenewalDueForReminder(renewalKey, today)) continue;

    const dedupe = renewalNotifyDedupeKey(item.id, renewalKey);
    if (notified[dedupe] === today) continue;

    sendNotification({
      title: `${item.content} — renewal`,
      body: renewalNotificationBody(item, renewalKey, today),
      extra: { subscriptionId: item.id },
    });

    notified[dedupe] = today;
    dirty = true;
  }

  if (dirty) {
    saveSettings({
      ...settings,
      subscriptionRenewalNotified: notified,
    });
  }
}

/** Focus app and open Subscriptions when user clicks a renewal toast. */
export async function registerRenewalNotificationActions(
  onOpenSubscription: (id: string) => void,
): Promise<PluginListener | undefined> {
  if (!isTauriRuntime()) return undefined;
  return onAction((action) => {
    const id = action.extra?.subscriptionId;
    if (typeof id === "string" && id.length > 0) {
      const win = getCurrentWindow();
      void win.show();
      void win.setFocus();
      onOpenSubscription(id);
    }
  });
}
