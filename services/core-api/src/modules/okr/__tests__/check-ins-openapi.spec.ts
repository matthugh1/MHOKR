/**
 * OpenAPI Schema Smoke Test
 * 
 * Verifies that the two new check-in endpoints are documented in OpenAPI/Swagger.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../../../src/app.module';

describe('OpenAPI Schema - Check-ins Endpoints', () => {
  let app: INestApplication;
  let swaggerDocument: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Generate Swagger document (same as main.ts)
    const config = new DocumentBuilder()
      .setTitle('OKR Nexus Core API')
      .setDescription('Core API for OKR Nexus platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    swaggerDocument = SwaggerModule.createDocument(app, config);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /key-results/:id/check-ins', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/key-results/{id}/check-ins'];
      expect(path).toBeDefined();
      expect(path.get).toBeDefined();
    });

    it('should have correct operation summary', () => {
      const operation = swaggerDocument.paths?.['/key-results/{id}/check-ins']?.get;
      expect(operation).toBeDefined();
      expect(operation.summary).toContain('check-in history');
    });

    it('should have pagination query parameters', () => {
      const operation = swaggerDocument.paths?.['/key-results/{id}/check-ins']?.get;
      const parameters = operation?.parameters || [];
      const pageParam = parameters.find((p: any) => p.name === 'page');
      const limitParam = parameters.find((p: any) => p.name === 'limit');
      
      expect(pageParam).toBeDefined();
      expect(limitParam).toBeDefined();
    });

    it('should have response schema defined', () => {
      const operation = swaggerDocument.paths?.['/key-results/{id}/check-ins']?.get;
      const responses = operation?.responses;
      expect(responses?.['200']).toBeDefined();
      expect(responses?.['200'].schema).toBeDefined();
    });
  });

  describe('GET /reports/check-ins/overdue', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/reports/check-ins/overdue'];
      expect(path).toBeDefined();
      expect(path.get).toBeDefined();
    });

    it('should have correct operation summary', () => {
      const operation = swaggerDocument.paths?.['/reports/check-ins/overdue']?.get;
      expect(operation).toBeDefined();
      expect(operation.summary).toContain('overdue');
    });

    it('should have filter query parameters', () => {
      const operation = swaggerDocument.paths?.['/reports/check-ins/overdue']?.get;
      const parameters = operation?.parameters || [];
      const cycleIdParam = parameters.find((p: any) => p.name === 'cycleId');
      const ownerIdParam = parameters.find((p: any) => p.name === 'ownerId');
      const limitParam = parameters.find((p: any) => p.name === 'limit');
      
      expect(cycleIdParam).toBeDefined();
      expect(ownerIdParam).toBeDefined();
      expect(limitParam).toBeDefined();
    });

    it('should have response schema defined', () => {
      const operation = swaggerDocument.paths?.['/reports/check-ins/overdue']?.get;
      const responses = operation?.responses;
      expect(responses?.['200']).toBeDefined();
      expect(responses?.['200'].schema).toBeDefined();
    });
  });
});


