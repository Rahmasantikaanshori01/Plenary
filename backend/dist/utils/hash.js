"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
const SALT_ROUNDS = 12;
async function hashPassword(plain) {
    return bcrypt_1.default.hash(plain, SALT_ROUNDS);
}
async function comparePassword(plain, hashed) {
    return bcrypt_1.default.compare(plain, hashed);
}
//# sourceMappingURL=hash.js.map