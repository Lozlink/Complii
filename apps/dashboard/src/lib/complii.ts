import { Complii } from '@complii/sdk';

export function getCompliiClient() {
  const apiKey = process.env.NEXT_PUBLIC_COMPLII_API_KEY;
  const environment = process.env.NEXT_PUBLIC_COMPLII_ENV as 'production' | 'staging' | undefined;

  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_COMPLII_API_KEY is not set');
  }

  return new Complii({
    apiKey,
    environment: environment || 'production',
  });
}
