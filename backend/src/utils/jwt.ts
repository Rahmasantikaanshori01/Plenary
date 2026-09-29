import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "plenary_dev_secret";
const EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

export interface JwtPayload {
  userId: string;
  role: string;
  email?: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload as object, SECRET, { expiresIn: EXPIRES } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as unknown as JwtPayload;
}
