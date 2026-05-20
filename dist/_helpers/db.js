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
exports.db = void 0;
exports.initialize = initialize;
const sequelize_1 = require("sequelize");
const mysql2_1 = __importDefault(require("mysql2"));
const config = require('../config.json');
exports.db = {};
function initialize() {
    return __awaiter(this, void 0, void 0, function* () {
        const { host, port, user, password, database } = config.database;
        // create db if it doesn't already exist
        const connection = yield mysql2_1.default.createConnection({ host, port, user, password });
        yield connection.promise().query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
        // connect to db
        const sequelize = new sequelize_1.Sequelize(database, user, password, {
            dialect: 'mysql',
            host,
            port
        });
        // init models and add them to the exported db object
        exports.db.Account = require('../accounts/account.model').accountModel(sequelize);
        exports.db.RefreshToken = require('../accounts/refresh-token.model').refreshTokenModel(sequelize);
        // define relationships
        exports.db.Account.hasMany(exports.db.RefreshToken, { onDelete: 'CASCADE' });
        exports.db.RefreshToken.belongsTo(exports.db.Account);
        // sync all models with database
        yield sequelize.sync({ alter: true });
    });
}
