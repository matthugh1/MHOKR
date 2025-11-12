/**
 * OKR State Transition Service Tests
 * 
 * Unit tests for OkrStateTransitionService:
 * - Valid transitions for Objectives
 * - Valid transitions for Key Results
 * - Invalid transitions throw BadRequestException
 * - State calculation from legacy status/isPublished
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OkrStateTransitionService } from '../okr-state-transition.service';
import { BadRequestException } from '@nestjs/common';

describe('OkrStateTransitionService', () => {
  let service: OkrStateTransitionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OkrStateTransitionService],
    }).compile();

    service = module.get<OkrStateTransitionService>(OkrStateTransitionService);
  });

  describe('Objective State Transitions', () => {
    it('should allow DRAFT → PUBLISHED', () => {
      expect(() => service.assertObjectiveStateTransition('DRAFT', 'PUBLISHED')).not.toThrow();
    });

    it('should allow DRAFT → COMPLETED', () => {
      expect(() => service.assertObjectiveStateTransition('DRAFT', 'COMPLETED')).not.toThrow();
    });

    it('should allow DRAFT → CANCELLED', () => {
      expect(() => service.assertObjectiveStateTransition('DRAFT', 'CANCELLED')).not.toThrow();
    });

    it('should allow PUBLISHED → DRAFT', () => {
      expect(() => service.assertObjectiveStateTransition('PUBLISHED', 'DRAFT')).not.toThrow();
    });

    it('should allow PUBLISHED → COMPLETED', () => {
      expect(() => service.assertObjectiveStateTransition('PUBLISHED', 'COMPLETED')).not.toThrow();
    });

    it('should allow PUBLISHED → CANCELLED', () => {
      expect(() => service.assertObjectiveStateTransition('PUBLISHED', 'CANCELLED')).not.toThrow();
    });

    it('should allow COMPLETED → ARCHIVED', () => {
      expect(() => service.assertObjectiveStateTransition('COMPLETED', 'ARCHIVED')).not.toThrow();
    });

    it('should allow CANCELLED → ARCHIVED', () => {
      expect(() => service.assertObjectiveStateTransition('CANCELLED', 'ARCHIVED')).not.toThrow();
    });

    it('should reject DRAFT → ARCHIVED', () => {
      expect(() => service.assertObjectiveStateTransition('DRAFT', 'ARCHIVED')).toThrow(BadRequestException);
    });

    it('should reject PUBLISHED → ARCHIVED', () => {
      expect(() => service.assertObjectiveStateTransition('PUBLISHED', 'ARCHIVED')).toThrow(BadRequestException);
    });

    it('should reject ARCHIVED → DRAFT', () => {
      expect(() => service.assertObjectiveStateTransition('ARCHIVED', 'DRAFT')).toThrow(BadRequestException);
    });

    it('should reject ARCHIVED → PUBLISHED', () => {
      expect(() => service.assertObjectiveStateTransition('ARCHIVED', 'PUBLISHED')).toThrow(BadRequestException);
    });

    it('should reject COMPLETED → DRAFT', () => {
      expect(() => service.assertObjectiveStateTransition('COMPLETED', 'DRAFT')).toThrow(BadRequestException);
    });

    it('should reject CANCELLED → PUBLISHED', () => {
      expect(() => service.assertObjectiveStateTransition('CANCELLED', 'PUBLISHED')).toThrow(BadRequestException);
    });

    it('should reject invalid current state', () => {
      expect(() => service.assertObjectiveStateTransition('INVALID', 'DRAFT')).toThrow(BadRequestException);
    });
  });

  describe('Key Result State Transitions', () => {
    it('should allow DRAFT → PUBLISHED', () => {
      expect(() => service.assertKeyResultStateTransition('DRAFT', 'PUBLISHED')).not.toThrow();
    });

    it('should allow DRAFT → COMPLETED', () => {
      expect(() => service.assertKeyResultStateTransition('DRAFT', 'COMPLETED')).not.toThrow();
    });

    it('should allow DRAFT → CANCELLED', () => {
      expect(() => service.assertKeyResultStateTransition('DRAFT', 'CANCELLED')).not.toThrow();
    });

    it('should allow PUBLISHED → DRAFT', () => {
      expect(() => service.assertKeyResultStateTransition('PUBLISHED', 'DRAFT')).not.toThrow();
    });

    it('should allow PUBLISHED → COMPLETED', () => {
      expect(() => service.assertKeyResultStateTransition('PUBLISHED', 'COMPLETED')).not.toThrow();
    });

    it('should allow PUBLISHED → CANCELLED', () => {
      expect(() => service.assertKeyResultStateTransition('PUBLISHED', 'CANCELLED')).not.toThrow();
    });

    it('should allow COMPLETED → ARCHIVED', () => {
      expect(() => service.assertKeyResultStateTransition('COMPLETED', 'ARCHIVED')).not.toThrow();
    });

    it('should allow CANCELLED → ARCHIVED', () => {
      expect(() => service.assertKeyResultStateTransition('CANCELLED', 'ARCHIVED')).not.toThrow();
    });

    it('should reject DRAFT → ARCHIVED', () => {
      expect(() => service.assertKeyResultStateTransition('DRAFT', 'ARCHIVED')).toThrow(BadRequestException);
    });

    it('should reject ARCHIVED → DRAFT', () => {
      expect(() => service.assertKeyResultStateTransition('ARCHIVED', 'DRAFT')).toThrow(BadRequestException);
    });
  });

  describe('State Calculation from Legacy Fields', () => {
    it('should calculate COMPLETED from status=COMPLETED', () => {
      expect(service.calculateObjectiveStateFromLegacy('COMPLETED', false)).toBe('COMPLETED');
      expect(service.calculateObjectiveStateFromLegacy('COMPLETED', true)).toBe('COMPLETED');
    });

    it('should calculate CANCELLED from status=CANCELLED', () => {
      expect(service.calculateObjectiveStateFromLegacy('CANCELLED', false)).toBe('CANCELLED');
      expect(service.calculateObjectiveStateFromLegacy('CANCELLED', true)).toBe('CANCELLED');
    });

    it('should calculate PUBLISHED from isPublished=true and status not COMPLETED/CANCELLED', () => {
      expect(service.calculateObjectiveStateFromLegacy('ON_TRACK', true)).toBe('PUBLISHED');
      expect(service.calculateObjectiveStateFromLegacy('AT_RISK', true)).toBe('PUBLISHED');
      expect(service.calculateObjectiveStateFromLegacy('OFF_TRACK', true)).toBe('PUBLISHED');
    });

    it('should calculate DRAFT from isPublished=false and status not COMPLETED/CANCELLED', () => {
      expect(service.calculateObjectiveStateFromLegacy('ON_TRACK', false)).toBe('DRAFT');
      expect(service.calculateObjectiveStateFromLegacy('AT_RISK', false)).toBe('DRAFT');
      expect(service.calculateObjectiveStateFromLegacy('OFF_TRACK', false)).toBe('DRAFT');
    });

    it('should prioritize COMPLETED over isPublished', () => {
      expect(service.calculateObjectiveStateFromLegacy('COMPLETED', true)).toBe('COMPLETED');
    });

    it('should prioritize CANCELLED over isPublished', () => {
      expect(service.calculateObjectiveStateFromLegacy('CANCELLED', true)).toBe('CANCELLED');
    });
  });
});

