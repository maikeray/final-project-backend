import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'yamljs';
import path from 'path';

export function swaggerDocs(app: express.Application) {
    const swaggerDocument = yaml.load(path.join(__dirname, '../../swagger.yaml'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}