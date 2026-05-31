export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{9,14}$/.test(phone.trim());
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8;
}
