// Generate unique protocol like FDF5D65F5D66D
export function generateProtocol(): string {
  const chars = '0123456789ABCDEF';
  let protocol = '';
  for (let i = 0; i < 13; i++) {
    protocol += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return protocol;
}

// Generate random string for tokens
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Format date for display
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

// Sanitize user input
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
