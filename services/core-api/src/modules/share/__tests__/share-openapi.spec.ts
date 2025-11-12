/**
 * OpenAPI Schema Test for Share Links Endpoints
 * 
 * Verifies that share link endpoints are documented in OpenAPI/Swagger.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../../../src/app.module';

describe('OpenAPI Schema - Share Links Endpoints', () => {
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

  describe('POST /okrs/:type/:id/share', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/okrs/{type}/{id}/share'];
      expect(path).toBeDefined();
      expect(path.post).toBeDefined();
    });

    it('should have correct operation summary', () => {
      const operation = swaggerDocument.paths?.['/okrs/{type}/{id}/share']?.post;
      expect(operation).toBeDefined();
      expect(operation.summary).toContain('share link');
    });

    it('should have type and id path parameters', () => {
      const operation = swaggerDocument.paths?.['/okrs/{type}/{id}/share']?.post;
      const parameters = operation?.parameters || [];
      const typeParam = parameters.find((p: any) => p.name === 'type');
      const idParam = parameters.find((p: any) => p.name === 'id');
      
      expect(typeParam).toBeDefined();
      expect(idParam).toBeDefined();
    });

    it('should have request body schema', () => {
      const operation = swaggerDocument.paths?.['/okrs/{type}/{id}/share']?.post;
      expect(operation?.requestBody).toBeDefined();
      expect(operation?.requestBody?.content?.['application/json']).toBeDefined();
    });

    it('should have response schemas defined', () => {
      const operation = swaggerDocument.paths?.['/okrs/{type}/{id}/share']?.post;
      const responses = operation?.responses;
      expect(responses?.['201']).toBeDefined();
      expect(responses?.['400']).toBeDefined();
      expect(responses?.['403']).toBeDefined();
      expect(responses?.['404']).toBeDefined();
      expect(responses?.['429']).toBeDefined();
    });
  });

  describe('DELETE /share/:shareId', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/share/{shareId}'];
      expect(path).toBeDefined();
      expect(path.delete).toBeDefined();
    });

    it('should have correct operation summary', () => {
      const operation = swaggerDocument.paths?.['/share/{shareId}']?.delete;
      expect(operation).toBeDefined();
      expect(operation.summary).toContain('revoke');
    });

    it('should have shareId path parameter', () => {
      const operation = swaggerDocument.paths?.['/share/{shareId}']?.delete;
      const parameters = operation?.parameters || [];
      const shareIdParam = parameters.find((p: any) => p.name === 'shareId');
      
      expect(shareIdParam).toBeDefined();
    });

    it('should have response schemas defined', () => {
      const operation = swaggerDocument.paths?.['/share/{shareId}']?.delete;
      const responses = operation?.responses;
      expect(responses?.['200']).toBeDefined();
      expect(responses?.['403']).toBeDefined();
      expect(responses?.['404']).toBeDefined();
      expect(responses?.['429']).toBeDefined();
    });
  });

  describe('GET /share/:shareId', () => {
    it('should be documented in OpenAPI schema', () => {
      const path = swaggerDocument.paths?.['/share/{shareId}'];
      expect(path).toBeDefined();
      expect(path.get).toBeDefined();
    });

    it('should have correct operation summary', () => {
      const operation = swaggerDocument.paths?.['/share/{shareId}']?.get;
      expect(operation).toBeDefined();
      expect(operation.summary).toContain('resolve');
    });

    it('should have shareId path parameter', () => {
      const operation = swaggerDocument.paths?.['/share/{shareId}']?.get;
      const parameters = operation?.parameters || [];
      const shareIdParam = parameters.find((p: any) => p.name === 'shareId');
      
      expect(shareIdParam).toBeDefined();
    });

    it('should have response schemas defined', () => {
      const operation = swaggerDocument.paths?.['/share/{shareId}']?.get;
      const responses = operation?.responses;
      expect(responses?.['200']).toBeDefined();
      expect(responses?.['404']).toBeDefined();
    });
  });
});


