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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const sequelize_1 = require("sequelize");
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("../_helpers/db");
const role_1 = require("../_helpers/role");
const send_email_1 = require("../_helpers/send-email");
const config = require('../config.json');
exports.accountService = {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: _delete
};
function authenticate(_a) {
    return __awaiter(this, arguments, void 0, function* ({ email, password, ipAddress }) {
        const account = yield db_1.db.Account.scope('withHash').findOne({ where: { email } });
        if (!account || !account.isVerified || !bcryptjs_1.default.compareSync(password, account.passwordHash)) {
            throw 'Email or password is incorrect';
        }
        const jwtToken = generateJwtToken(account);
        const refreshToken = yield generateRefreshToken(account, ipAddress);
        yield refreshToken.save();
        return Object.assign(Object.assign({}, basicDetails(account)), { jwtToken, refreshToken: refreshToken.token });
    });
}
function refreshToken(_a) {
    return __awaiter(this, arguments, void 0, function* ({ token, ipAddress }) {
        const refreshToken = yield getRefreshToken(token);
        const account = yield refreshToken.getAccount();
        const newRefreshToken = yield generateRefreshToken(account, ipAddress);
        refreshToken.revoked = new Date();
        refreshToken.revokedByIp = ipAddress;
        refreshToken.replacedByToken = newRefreshToken.token;
        yield refreshToken.save();
        yield newRefreshToken.save();
        const jwtToken = generateJwtToken(account);
        return Object.assign(Object.assign({}, basicDetails(account)), { jwtToken, refreshToken: newRefreshToken.token });
    });
}
function revokeToken(_a) {
    return __awaiter(this, arguments, void 0, function* ({ token, ipAddress }) {
        const refreshToken = yield getRefreshToken(token);
        refreshToken.revoked = new Date();
        refreshToken.revokedByIp = ipAddress;
        yield refreshToken.save();
    });
}
function register(params, origin) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield db_1.db.Account.findOne({ where: { email: params.email } })) {
            return yield sendAlreadyRegisteredEmail(params.email, origin);
        }
        const account = new db_1.db.Account(params);
        const isFirstAccount = (yield db_1.db.Account.count()) === 0;
        account.role = isFirstAccount ? role_1.Role.Admin : role_1.Role.User;
        account.verificationToken = randomTokenString();
        account.passwordHash = bcryptjs_1.default.hashSync(params.password, 10);
        yield account.save();
        yield sendVerificationEmail(account, origin);
    });
}
function verifyEmail(_a) {
    return __awaiter(this, arguments, void 0, function* ({ token }) {
        const account = yield db_1.db.Account.findOne({ where: { verificationToken: token } });
        if (!account)
            throw 'Verification failed';
        account.verified = new Date();
        account.verificationToken = null;
        yield account.save();
    });
}
function forgotPassword(_a, origin_1) {
    return __awaiter(this, arguments, void 0, function* ({ email }, origin) {
        const account = yield db_1.db.Account.findOne({ where: { email } });
        if (!account)
            return;
        account.resetToken = randomTokenString();
        account.resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        yield account.save();
        yield sendPasswordResetEmail(account, origin);
    });
}
function validateResetToken(_a) {
    return __awaiter(this, arguments, void 0, function* ({ token }) {
        const account = yield db_1.db.Account.findOne({
            where: {
                resetToken: token,
                resetTokenExpires: { [sequelize_1.Op.gt]: new Date() }
            }
        });
        if (!account)
            throw 'Invalid token';
        return account;
    });
}
function resetPassword(_a) {
    return __awaiter(this, arguments, void 0, function* ({ token, password }) {
        const account = yield validateResetToken({ token });
        account.passwordHash = bcryptjs_1.default.hashSync(password, 10);
        account.passwordReset = new Date();
        account.resetToken = null;
        account.resetTokenExpires = null;
        yield account.save();
    });
}
function getAll() {
    return __awaiter(this, void 0, void 0, function* () {
        const accounts = yield db_1.db.Account.findAll();
        return accounts.map((x) => basicDetails(x));
    });
}
function getById(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const account = yield getAccount(id);
        return basicDetails(account);
    });
}
function create(params) {
    return __awaiter(this, void 0, void 0, function* () {
        if (yield db_1.db.Account.findOne({ where: { email: params.email } })) {
            throw `Email '${params.email}' is already registered`;
        }
        const account = new db_1.db.Account(params);
        account.verified = new Date();
        account.passwordHash = bcryptjs_1.default.hashSync(params.password, 10);
        yield account.save();
        return basicDetails(account);
    });
}
function update(id, params) {
    return __awaiter(this, void 0, void 0, function* () {
        const account = yield getAccount(id);
        if (params.email && account.email !== params.email &&
            (yield db_1.db.Account.findOne({ where: { email: params.email } }))) {
            throw `Email '${params.email}' is already registered`;
        }
        if (params.password) {
            params.passwordHash = bcryptjs_1.default.hashSync(params.password, 10);
        }
        Object.assign(account, params);
        account.updated = new Date();
        yield account.save();
        return basicDetails(account);
    });
}
function _delete(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const account = yield getAccount(id);
        yield account.destroy();
    });
}
// helper functions
function getAccount(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const account = yield db_1.db.Account.findByPk(id);
        if (!account)
            throw 'Account not found';
        return account;
    });
}
function getRefreshToken(token) {
    return __awaiter(this, void 0, void 0, function* () {
        const refreshToken = yield db_1.db.RefreshToken.findOne({ where: { token } });
        if (!refreshToken || !refreshToken.isActive)
            throw 'Invalid token';
        return refreshToken;
    });
}
function generateJwtToken(account) {
    return jsonwebtoken_1.default.sign({ sub: account.id, id: account.id }, config.secret, { expiresIn: '15m' });
}
function generateRefreshToken(account, ipAddress) {
    return __awaiter(this, void 0, void 0, function* () {
        return new db_1.db.RefreshToken({
            accountId: account.id,
            token: randomTokenString(),
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdByIp: ipAddress
        });
    });
}
function randomTokenString() {
    return crypto_1.default.randomBytes(40).toString('hex');
}
function basicDetails(account) {
    const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}
function sendVerificationEmail(account, origin) {
    return __awaiter(this, void 0, void 0, function* () {
        let message;
        if (origin) {
            const verifyUrl = `${origin}/account/verify-email?token=${account.verificationToken}`;
            message = `<p>Please click the below link to verify your email address:</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
        }
        else {
            message = `<p>Please use the below token to verify your email address with the 
                   <code>/accounts/verify-email</code> api route:</p>
                   <p><code>${account.verificationToken}</code></p>`;
        }
        yield (0, send_email_1.sendEmail)({
            to: account.email,
            subject: 'Sign-up Verification API - Verify Email',
            html: `<h4>Verify Email</h4>
               <p>Thanks for registering!</p>
               ${message}`
        });
    });
}
function sendAlreadyRegisteredEmail(email, origin) {
    return __awaiter(this, void 0, void 0, function* () {
        let message;
        if (origin) {
            message = `<p>If you don't know your password please visit the 
                   <a href="${origin}/account/forgot-password">forgot password</a> page.</p>`;
        }
        else {
            message = `<p>If you don't know your password you can reset it via the 
                   <code>/accounts/forgot-password</code> api route.</p>`;
        }
        yield (0, send_email_1.sendEmail)({
            to: email,
            subject: 'Sign-up Verification API - Email Already Registered',
            html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${email}</strong> is already registered.</p>
               ${message}`
        });
    });
}
function sendPasswordResetEmail(account, origin) {
    return __awaiter(this, void 0, void 0, function* () {
        let message;
        if (origin) {
            const resetUrl = `${origin}/account/reset-password?token=${account.resetToken}`;
            message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>`;
        }
        else {
            message = `<p>Please use the below token to reset your password with the 
                   <code>/accounts/reset-password</code> api route:</p>
                   <p><code>${account.resetToken}</code></p>`;
        }
        yield (0, send_email_1.sendEmail)({
            to: account.email,
            subject: 'Sign-up Verification API - Reset Password',
            html: `<h4>Reset Password Email</h4>
               ${message}`
        });
    });
}
