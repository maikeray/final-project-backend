import { Sequelize } from 'sequelize';

export const db: any = {};

export async function initialize() {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306');
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || 'admin1234';
    const database = process.env.DB_NAME || 'node-mysql-boilerplate';

    // connect to db with pool
    const sequelize = new Sequelize(database, user, password, { 
        dialect: 'mysql',
        host,
        port,
        pool: {
            max: 5,
            min: 0,
            acquire: 60000,
            idle: 10000
        },
        dialectOptions: {
            connectTimeout: 60000
        }
    });

    // init models and add them to the exported db object
    db.Account = require('../accounts/account.model').accountModel(sequelize);
    db.RefreshToken = require('../accounts/refresh-token.model').refreshTokenModel(sequelize);

    // define relationships
    db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE' });
    db.RefreshToken.belongsTo(db.Account);

    // sync all models with database
    await sequelize.sync({ alter: true });
}