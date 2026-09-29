"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
exports.getAuthUser = getAuthUser;
const jwt_1 = require("../utils/jwt");
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ message: "Token tidak ditemukan. Silakan login." });
        return;
    }
    try {
        const token = header.split(" ")[1];
        const payload = (0, jwt_1.verifyToken)(token);
        req.authUser = payload;
        next();
    }
    catch {
        res.status(401).json({ message: "Token tidak valid atau sudah expired." });
    }
}
function authorize(...roles) {
    return (req, res, next) => {
        const user = req.authUser;
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
function getAuthUser(req) {
    return req.authUser;
}
//# sourceMappingURL=auth.js.map