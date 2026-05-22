/**
 * Expo Push Notifications — thin HTTP wrapper.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type Message = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const message: Message = { to: expoPushToken, title, body };
  if (data) message.data = data;
  await postBatch([message]);
}

export async function sendPushToMany(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map<Message>((to) => ({ to, title, body, ...(data ? { data } : {}) }));
  await postBatch(messages);
}

async function postBatch(messages: Message[]): Promise<void> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.warn(`[push] non-OK ${res.status} for batch of ${messages.length}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.warn(`[push] send failed: ${message}`);
  }
}
