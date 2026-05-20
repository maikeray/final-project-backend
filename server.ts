import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initialize } from './_helpers/db';
import { errorHandler } from './_middleware/error-handler';
import { accountsController } from './accounts/accounts.controller';
import { swaggerDocs } from './_helpers/swagger';

const app = express();

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true
}));

// routes
app.use('/accounts', accountsController);

// swagger docs
swaggerDocs(app);

// global error handler
app.use(errorHandler);

// start server
const PORT = process.env.PORT || 4000;
initialize().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});