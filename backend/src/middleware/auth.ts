import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token tidak ditemukan. Silakan login." });
    return;
  }

  try {
    const token = header.split(" ")[1];
    const payload = verifyToken(token);
    (req as unknown as Record<string, unknown>).authUser = payload;
    next();
  } catch {
    res.status(401).json({ message: "Token tidak valid atau sudah expired." });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as unknown as Record<string, unknown>).authUser as JwtPayload | undefined;
    if (!user) {
      res.status(401).json({ message: "Tidak terautentikasi." });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ message: "Anda tidak memiliki akses." });
      return;
    }
    next();
  };
}

export function getAuthUser(req: Request): JwtPayload {
  return (req as unknown as Record<string, unknown>).authUser as JwtPayload;
}
