import express from 'express';
import { accountService } from './account.service';
import { authorize } from '../_middleware/authorize';
import { validateRequest } from '../_middleware/validate-request';
import { Role } from '../_helpers/role';
import Joi from 'joi';

export const accountsController = express.Router();

// routes
accountsController.post('/authenticate', authenticateSchema, authenticate);
accountsController.post('/refresh-token', refreshToken);
accountsController.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
accountsController.post('/register', registerSchema, register);
accountsController.post('/verify-email', verifyEmailSchema, verifyEmail);
accountsController.post('/forgot-password', forgotPasswordSchema, forgotPassword);
accountsController.post('/validate-reset-token', validateResetTokenSchema, validateResetToken);
accountsController.post('/reset-password', resetPasswordSchema, resetPassword);
accountsController.get('/', authorize(Role.Admin), getAll);
accountsController.get('/:id', authorize(), getById);
accountsController.post('/', authorize(Role.Admin), createSchema, create);
accountsController.put('/:id', authorize(), updateSchema, update);
accountsController.delete('/:id', authorize(), _delete);

// route functions
function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { email, password } = req.body;
    const ipAddress = req.ip!;
    accountService.authenticate({ email, password, ipAddress })
        .then(({ refreshToken, ...account }) => {
            setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}

function refreshToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = req.cookies.refreshToken;
    const ipAddress = req.ip!;
    
    if (!token) {
        return res.status(401).json({ message: 'No refresh token' });
    }
    
    accountService.refreshToken({ token, ipAddress })
        .then(({ refreshToken, ...account }) => {
            setTokenCookie(res, refreshToken);
            res.json(account);
        })
        .catch(next);
}

function revokeToken(req: any, res: express.Response, next: express.NextFunction) {
    const token = req.body.token || req.cookies.refreshToken;
    const ipAddress = req.ip;

    if (!token) return res.status(400).json({ message: 'Token is required' });

    if (!req.user.ownsToken(token) && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService.revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}

function register(req: express.Request, res: express.Response, next: express.NextFunction) {
    accountService.register(req.body, req.get('origin')!)
        .then(() => res.json({ message: 'Registration successful, please check your email for verification instructions' }))
        .catch(next);
}

function verifyEmail(req: express.Request, res: express.Response, next: express.NextFunction) {
    accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful, you can now login' }))
        .catch(next);
}

function forgotPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
    accountService.forgotPassword(req.body, req.get('origin')!)
        .then(() => res.json({ message: 'Please check your email for password reset instructions' }))
        .catch(next);
}

function validateResetToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}

function resetPassword(req: express.Request, res: express.Response, next: express.NextFunction) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

function getAll(req: express.Request, res: express.Response, next: express.NextFunction) {
    accountService.getAll()
        .then(accounts => res.json(accounts))
        .catch(next);
}

function getById(req: any, res: express.Response, next: express.NextFunction) {
    if (req.params.id !== req.user.id.toString() && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    accountService.getById(req.params.id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}

function create(req: express.Request, res: express.Response, next: express.NextFunction) {
    accountService.create(req.body)
        .then(account => res.json(account))
        .catch(next);
}

function update(req: any, res: express.Response, next: express.NextFunction) {
    if (req.params.id !== req.user.id.toString() && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    accountService.update(req.params.id, req.body)
        .then(account => res.json(account))
        .catch(next);
}

function _delete(req: any, res: express.Response, next: express.NextFunction) {
    if (req.params.id !== req.user.id.toString() && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    accountService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}

// schema functions
function authenticateSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({
        email: Joi.string().required(),
        password: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function registerSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({
        title: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        acceptTerms: Joi.boolean().valid(true).required()
    });
    validateRequest(req, next, schema);
}

function verifyEmailSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({ token: Joi.string().required() });
    validateRequest(req, next, schema);
}

function forgotPasswordSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({ email: Joi.string().email().required() });
    validateRequest(req, next, schema);
}

function validateResetTokenSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({ token: Joi.string().required() });
    validateRequest(req, next, schema);
}

function resetPasswordSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({
        token: Joi.string().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    });
    validateRequest(req, next, schema);
}

function revokeTokenSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({ token: Joi.string().empty('') });
    validateRequest(req, next, schema);
}

function createSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({
        title: Joi.string().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
        role: Joi.string().valid(Role.Admin, Role.User).required()
    });
    validateRequest(req, next, schema);
}

function updateSchema(req: express.Request, res: express.Response, next: express.NextFunction) {
    const schema = Joi.object({
        title: Joi.string().empty(''),
        firstName: Joi.string().empty(''),
        lastName: Joi.string().empty(''),
        email: Joi.string().email().empty(''),
        password: Joi.string().min(6).empty(''),
        confirmPassword: Joi.string().valid(Joi.ref('password')).empty('')
    }).with('password', 'confirmPassword');
    validateRequest(req, next, schema);
}

function setTokenCookie(res: express.Response, token: string) {
    const cookieOptions = {
        httpOnly: true,
        expires: new Date(Date.now() + 7*24*60*60*1000),
        sameSite: 'none' as const,
        secure: true,
        path: '/'
    };
    res.cookie('refreshToken', token, cookieOptions);
}