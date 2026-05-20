"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = authorize;
const express_jwt_1 = require("express-jwt");
const db_1 = require("../_helpers/db");
const config = require('../config.json');
function authorize(roles = []) {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    return [
        // authenticate JWT token and attach user to request object (req.user)
        (0, express_jwt_1.expressjwt)({ secret: config.secret, algorithms: ['HS256'] }),
        // authorize based on user role
        (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const account = yield db_1.db.Account.findByPk(req.auth.id);
            if (!account || (roles.length && !roles.includes(account.role))) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            // authentication and authorization successful
            req.user = req.auth;
            req.user.role = account.role;
            req.user.ownsToken = (token) => !!db_1.db.RefreshToken.findOne({ where: { accountId: account.id, token } });
            next();
        })
    ];
}
