/**
 * Step source abstraction.
 *
 * Phase 2 ships a DEV STUB — an in-memory counter you can bump from the UI.
 * Lets you test the full join → sync → resolve loop inside Expo Go without
 * a custom dev client.
 *
 * TODO(real-health): wire iOS HealthKit (`react-native-health`) and Android
 * Health Connect (`react-native-health-connect`). Both need a custom dev client.
 */

let stubSteps = 0;

export async function requestHealthPermissions(): Promise<boolean> {
  return true;
}

export async function getTodaySteps(): Promise<number> {
  return stubSteps;
}

export function bumpStubSteps(by: number): number {
  stubSteps = Math.max(0, stubSteps + by);
  return stubSteps;
}

export function setStubSteps(value: number): number {
  stubSteps = Math.max(0, Math.floor(value));
  return stubSteps;
}
