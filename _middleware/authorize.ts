import { Request, Response, NextFunction } from 'express';
import { expressjwt } from 'express-jwt';
import { db } from '../_helpers/db';
const config = require('../config.json');

export function authorize(roles: string | string[] = []) {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return [
        // authenticate JWT token and attach user to request object (req.user)
        expressjwt({ secret: config.secret, algorithms: ['HS256'] }),

        // authorize based on user role
        async (req: any, res: Response, next: NextFunction) => {
            const account = await db.Account.findByPk(req.auth.id);

            if (!account || (roles.length && !roles.includes(account.role))) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // authentication and authorization successful
            req.user = req.auth;
            req.user.role = account.role;
            req.user.ownsToken = (token: string) => 
                !!db.RefreshToken.findOne({ where: { accountId: account.id, token } });
            next();
        }
    ];
}