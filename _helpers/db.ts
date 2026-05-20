import { Sequelize } from 'sequelize';
import mysql2 from 'mysql2';

export const db: any = {};

export async function initialize() {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306');
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || 'admin1234';
    const database = process.env.DB_NAME || 'node-mysql-boilerplate';

    // create db if it doesn't already exist
    const connection = await mysql2.createConnection({ host, port, user, password });
    await connection.promise().query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);

    // connect to db
    const sequelize = new Sequelize(database, user, password, { 
        dialect: 'mysql',
        host,
        port
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