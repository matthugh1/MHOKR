/**
 * OpenAPI Schema Test for Overview Filters
 * 
 * Verifies that filter query parameters are documented in OpenAPI/Swagger for GET /okr/overview.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../../../src/app.module';

describe('OpenAPI Schema - Overview Filters', () => {
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

  describe('GET /okr/overview', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/okr/overview'];
      expect(path).toBeDefined();
      expect(path.get).toBeDefined();
    });

    it('should have correct operation summary', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      expect(operation).toBeDefined();
      expect(operation.summary).toContain('overview');
    });

    it('should have tenantId query parameter', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      const parameters = operation?.parameters || [];
      const tenantIdParam = parameters.find((p: any) => p.name === 'tenantId');
      
      expect(tenantIdParam).toBeDefined();
    });

    it('should have cycleId query parameter', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      const parameters = operation?.parameters || [];
      const cycleIdParam = parameters.find((p: any) => p.name === 'cycleId');
      
      expect(cycleIdParam).toBeDefined();
    });

    it('should have status query parameter', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      const parameters = operation?.parameters || [];
      const statusParam = parameters.find((p: any) => p.name === 'status');
      
      expect(statusParam).toBeDefined();
    });

    it('should have scope query parameter', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      const parameters = operation?.parameters || [];
      const scopeParam = parameters.find((p: any) => p.name === 'scope');
      
      expect(scopeParam).toBeDefined();
    });

    it('should have visibilityLevel query parameter', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      const parameters = operation?.parameters || [];
      const visibilityParam = parameters.find((p: any) => p.name === 'visibilityLevel');
      
      expect(visibilityParam).toBeDefined();
    });

    it('should have ownerId query parameter', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      const parameters = operation?.parameters || [];
      const ownerIdParam = parameters.find((p: any) => p.name === 'ownerId');
      
      expect(ownerIdParam).toBeDefined();
    });

    it('should have pagination query parameters', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      const parameters = operation?.parameters || [];
      const pageParam = parameters.find((p: any) => p.name === 'page');
      const pageSizeParam = parameters.find((p: any) => p.name === 'pageSize');
      
      expect(pageParam).toBeDefined();
      expect(pageSizeParam).toBeDefined();
    });

    it('should have response schema defined', () => {
      const operation = swaggerDocument.paths?.['/okr/overview']?.get;
      const responses = operation?.responses;
      expect(responses?.['200']).toBeDefined();
    });
  });
});


