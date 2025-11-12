/**
 * OpenAPI Schema Test for Whitelist Endpoints
 * 
 * Verifies that whitelist endpoints are documented in OpenAPI/Swagger.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../../../src/app.module';

describe('OpenAPI Schema - Whitelist Endpoints', () => {
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

  describe('GET /rbac/whitelist/:tenantId', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}'];
      expect(path).toBeDefined();
      expect(path.get).toBeDefined();
    });

    it('should have tenantId path parameter', () => {
      const operation = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}']?.get;
      const parameters = operation?.parameters || [];
      const tenantIdParam = parameters.find((p: any) => p.name === 'tenantId');
      
      expect(tenantIdParam).toBeDefined();
    });

    it('should have response schema defined', () => {
      const operation = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}']?.get;
      const responses = operation?.responses;
      expect(responses?.['200']).toBeDefined();
    });
  });

  describe('POST /rbac/whitelist/:tenantId/add', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}/add'];
      expect(path).toBeDefined();
      expect(path.post).toBeDefined();
    });

    it('should have correct operation summary', () => {
      const operation = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}/add']?.post;
      expect(operation).toBeDefined();
      expect(operation.summary).toContain('whitelist');
    });

    it('should have request body schema', () => {
      const operation = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}/add']?.post;
      expect(operation?.requestBody).toBeDefined();
    });

    it('should have response schemas defined', () => {
      const operation = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}/add']?.post;
      const responses = operation?.responses;
      expect(responses?.['200']).toBeDefined();
      expect(responses?.['403']).toBeDefined();
      expect(responses?.['404']).toBeDefined();
      expect(responses?.['429']).toBeDefined();
    });
  });

  describe('POST /rbac/whitelist/:tenantId/remove', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}/remove'];
      expect(path).toBeDefined();
      expect(path.post).toBeDefined();
    });

    it('should have correct operation summary', () => {
      const operation = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}/remove']?.post;
      expect(operation).toBeDefined();
      expect(operation.summary).toContain('whitelist');
    });

    it('should have request body schema', () => {
      const operation = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}/remove']?.post;
      expect(operation?.requestBody).toBeDefined();
    });

    it('should have response schemas defined', () => {
      const operation = swaggerDocument.paths?.['/rbac/whitelist/{tenantId}/remove']?.post;
      const responses = operation?.responses;
      expect(responses?.['200']).toBeDefined();
      expect(responses?.['403']).toBeDefined();
      expect(responses?.['404']).toBeDefined();
      expect(responses?.['429']).toBeDefined();
    });
  });
});


