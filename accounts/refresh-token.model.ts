import { DataTypes, Sequelize } from 'sequelize';

export function refreshTokenModel(sequelize: Sequelize) {
    const attributes = {
        token: { type: DataTypes.STRING },
        expires: { type: DataTypes.DATE },
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        createdByIp: { type: DataTypes.STRING },
        revoked: { type: DataTypes.DATE },
        revokedByIp: { type: DataTypes.STRING },
        replacedByToken: { type: DataTypes.STRING },
        isExpired: {
            type: DataTypes.VIRTUAL,
            get() { return Date.now() >= (this as any).expires; }
        },
        isActive: {
            type: DataTypes.VIRTUAL,
            get() { return !(this as any).revoked && !(this as any).isExpired; }
        }
    };

    const options = { timestamps: false };

    return sequelize.define('RefreshToken', attributes, options);
}