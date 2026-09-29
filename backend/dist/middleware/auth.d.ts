import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "../utils/jwt";
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
export declare function authorize(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function getAuthUser(req: Request): JwtPayload;
//# sourceMappingURL=auth.d.ts.map