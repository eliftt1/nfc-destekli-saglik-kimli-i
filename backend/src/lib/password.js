import argon2 from 'argon2';

// OWASP'ın önerdiği Argon2id parametreleri.
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const hashPassword = (plain) => argon2.hash(plain, OPTIONS);

export async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

// Kullanıcı bulunamadığında da aynı maliyette doğrulama yapıp zamanlama farkını azaltır.
let dummyHash;
export async function burnPasswordCheck(plain) {
  dummyHash ??= await hashPassword('dummy-password-for-timing');
  await verifyPassword(dummyHash, plain);
}
