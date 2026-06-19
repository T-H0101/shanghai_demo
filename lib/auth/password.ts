import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64
const PARAMS = "N=16384,r=8,p=1"

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url")
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt$${PARAMS}$${salt}$${derived.toString("base64url")}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$")
  if (parts.length !== 4 || parts[0] !== "scrypt") return false

  const [, params, salt, expected] = parts
  if (params !== PARAMS || !salt || !expected) return false

  const expectedBuffer = Buffer.from(expected, "base64url")
  const actual = (await scrypt(password, salt, expectedBuffer.length)) as Buffer
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer)
}
