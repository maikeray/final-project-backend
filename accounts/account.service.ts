import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { db } from '../_helpers/db';
import { Role } from '../_helpers/role';
import { sendEmail } from '../_helpers/send-email';
const jwtSecret = process.env.JWT_SECRET || 'default-secret';

export const accountService = {
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

async function authenticate({ email, password, ipAddress }: 
    { email: string, password: string, ipAddress: string }) {
    const account = await db.Account.scope('withHash').findOne({ where: { email } });

    if (!account || !account.isVerified || !bcrypt.compareSync(password, account.passwordHash)) {
        throw 'Email or password is incorrect';
    }

    const jwtToken = generateJwtToken(account);
    const refreshToken = await generateRefreshToken(account, ipAddress);

    await refreshToken.save();

    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}

async function refreshToken({ token, ipAddress }: { token: string, ipAddress: string }) {
    const refreshToken = await getRefreshToken(token);
    const account = await refreshToken.getAccount();

    const newRefreshToken = await generateRefreshToken(account, ipAddress);
    refreshToken.revoked = new Date();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();

    const jwtToken = generateJwtToken(account);

    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}

async function revokeToken({ token, ipAddress }: { token: string, ipAddress: string }) {
    const refreshToken = await getRefreshToken(token);
    refreshToken.revoked = new Date();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}

async function register(params: any, origin: string) {
    if (await db.Account.findOne({ where: { email: params.email } })) {
        try { await sendAlreadyRegisteredEmail(params.email, origin); } catch (e) { console.error('Email error:', e); }
        return;
    }

    const account = new db.Account(params);
    const isFirstAccount = (await db.Account.count()) === 0;
    account.role = isFirstAccount ? Role.Admin : Role.User;
    account.verificationToken = randomTokenString();
    account.passwordHash = bcrypt.hashSync(params.password, 10);
    await account.save();

    try { await sendVerificationEmail(account, origin); } catch (e) { console.error('Email error:', e); }
}

async function verifyEmail({ token }: { token: string }) {
    const account = await db.Account.findOne({ where: { verificationToken: token } });
    if (!account) throw 'Verification failed';
    account.verified = new Date();
    account.verificationToken = null;
    await account.save();
}

async function forgotPassword({ email }: { email: string }, origin: string) {
    const account = await db.Account.findOne({ where: { email } });
    if (!account) return;
    account.resetToken = randomTokenString();
    account.resetTokenExpires = new Date(Date.now() + 24*60*60*1000);
    await account.save();
    await sendPasswordResetEmail(account, origin);
}

async function validateResetToken({ token }: { token: string }) {
    const account = await db.Account.findOne({
        where: {
            resetToken: token,
            resetTokenExpires: { [Op.gt]: new Date() }
        }
    });
    if (!account) throw 'Invalid token';
    return account;
}

async function resetPassword({ token, password }: { token: string, password: string }) {
    const account = await validateResetToken({ token });
    account.passwordHash = bcrypt.hashSync(password, 10);
    account.passwordReset = new Date();
    account.resetToken = null;
    account.resetTokenExpires = null;
    await account.save();
}

async function getAll() {
    const accounts = await db.Account.findAll();
    return accounts.map((x: any) => basicDetails(x));
}

async function getById(id: string) {
    const account = await getAccount(id);
    return basicDetails(account);
}

async function create(params: any) {
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw `Email '${params.email}' is already registered`;
    }

    const account = new db.Account(params);
    account.verified = new Date();
    account.passwordHash = bcrypt.hashSync(params.password, 10);
    await account.save();
    return basicDetails(account);
}

async function update(id: string, params: any) {
    const account = await getAccount(id);

    if (params.email && account.email !== params.email && 
        await db.Account.findOne({ where: { email: params.email } })) {
        throw `Email '${params.email}' is already registered`;
    }

    if (params.password) {
        params.passwordHash = bcrypt.hashSync(params.password, 10);
    }

    Object.assign(account, params);
    account.updated = new Date();
    await account.save();
    return basicDetails(account);
}

async function _delete(id: string) {
    const account = await getAccount(id);
    await account.destroy();
}

// helper functions
async function getAccount(id: string) {
    const account = await db.Account.findByPk(id);
    if (!account) throw 'Account not found';
    return account;
}

async function getRefreshToken(token: string) {
    const refreshToken = await db.RefreshToken.findOne({ where: { token } });
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

function generateJwtToken(account: any) {
    return jwt.sign({ sub: account.id, id: account.id }, jwtSecret, { expiresIn: '15m' });
}

async function generateRefreshToken(account: any, ipAddress: string) {
    return new db.RefreshToken({
        accountId: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 7*24*60*60*1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account: any) {
    const { id, title, firstName, lastName, email, role, created, updated, isVerified } = account;
    return { id, title, firstName, lastName, email, role, created, updated, isVerified };
}

async function sendVerificationEmail(account: any, origin: string) {
    let message;
    if (origin) {
        const verifyUrl = `${origin}/account/verify-email?token=${account.verificationToken}`;
        message = `<p>Please click the below link to verify your email address:</p>
                   <p><a href="${verifyUrl}">${verifyUrl}</a></p>`;
    } else {
        message = `<p>Please use the below token to verify your email address with the 
                   <code>/accounts/verify-email</code> api route:</p>
                   <p><code>${account.verificationToken}</code></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Sign-up Verification API - Verify Email',
        html: `<h4>Verify Email</h4>
               <p>Thanks for registering!</p>
               ${message}`
    });
}

async function sendAlreadyRegisteredEmail(email: string, origin: string) {
    let message;
    if (origin) {
        message = `<p>If you don't know your password please visit the 
                   <a href="${origin}/account/forgot-password">forgot password</a> page.</p>`;
    } else {
        message = `<p>If you don't know your password you can reset it via the 
                   <code>/accounts/forgot-password</code> api route.</p>`;
    }

    await sendEmail({
        to: email,
        subject: 'Sign-up Verification API - Email Already Registered',
        html: `<h4>Email Already Registered</h4>
               <p>Your email <strong>${email}</strong> is already registered.</p>
               ${message}`
    });
}

async function sendPasswordResetEmail(account: any, origin: string) {
    let message;
    if (origin) {
        const resetUrl = `${origin}/account/reset-password?token=${account.resetToken}`;
        message = `<p>Please click the below link to reset your password, the link will be valid for 1 day:</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>`;
    } else {
        message = `<p>Please use the below token to reset your password with the 
                   <code>/accounts/reset-password</code> api route:</p>
                   <p><code>${account.resetToken}</code></p>`;
    }

    await sendEmail({
        to: account.email,
        subject: 'Sign-up Verification API - Reset Password',
        html: `<h4>Reset Password Email</h4>
               ${message}`
    });
}