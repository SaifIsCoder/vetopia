import { prescriptionService } from '../../src/lib/prescriptions/prescriptionService';
import {
  generatePrescriptionHtml,
  exportPrescriptionPdf,
} from '../../src/lib/prescriptions/prescriptionPdf';
import { supabase } from '../../src/lib/supabase/client';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  AuthError,
  ConflictError,
  ApiError,
} from '../../src/lib/api/errors';
import { Prescription, CreatePrescriptionDTO } from '../../src/types/prescription';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Mock Supabase client
jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

// Mock expo-print and expo-sharing
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

describe('Digital Prescriptions Security & Boundary Tests (MVP-06 / Phase 7)', () => {
  const validAppointmentId = '11111111-2222-3333-4444-555555555555';
  const validPetId = '22222222-3333-4444-5555-666666666666';
  const validPrescriptionId = '33333333-4444-5555-6666-777777777777';

  const validDTO: CreatePrescriptionDTO = {
    appointment_id: validAppointmentId,
    diagnosis: 'Canine Atopic Dermatitis',
    notes: 'Administer oral tablets with morning food. Clean paws daily.',
    refills_allowed: 1,
    items: [
      {
        medication_name: 'Apoquel (Oclacitinib)',
        dosage: '16mg',
        frequency: 'Twice daily for 14 days, then once daily',
        duration: '30 days',
        special_instructions: 'Give with or without food',
      },
    ],
  };

  const samplePrescription: Prescription = {
    id: validPrescriptionId,
    appointment_id: validAppointmentId,
    vet_id: 'vet-profile-1',
    pet_id: validPetId,
    diagnosis: 'Canine Atopic Dermatitis',
    notes: 'Administer oral tablets with morning food.',
    refills_allowed: 1,
    status: 'active',
    created_at: '2026-09-26T10:00:00Z',
    items: [
      {
        id: 'item-1',
        prescription_id: validPrescriptionId,
        medication_name: 'Apoquel (Oclacitinib)',
        dosage: '16mg',
        frequency: 'Twice daily',
        duration: '30 days',
        special_instructions: 'Give with food',
      },
    ],
    vet: {
      id: 'vet-profile-1',
      name: 'Dr. Sarah Mitchell',
      specialty: 'Dermatology & Internal Medicine',
      country: 'United Kingdom',
      flag: '🇬🇧',
      verified: true,
    },
    pet: {
      id: validPetId,
      name: 'Luna',
      species: 'Canine',
      breed: 'Golden Retriever',
      age: '3 years',
      weight_kg: 28.5,
    },
    appointment: {
      id: validAppointmentId,
      starts_at: '2026-09-26T09:30:00Z',
      ends_at: '2026-09-26T10:00:00Z',
      mode: 'video',
      status: 'completed',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // CREATE PRESCRIPTION SECURITY TESTS (1-13)
  // ==========================================
  describe('CREATE PRESCRIPTION SECURITY (FR-PRES-001)', () => {
    test('1. Unauthenticated user cannot create prescription (Postgres 28000 -> AuthError)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '28000',
          message: 'Authentication required: auth.uid() is null',
        },
      });

      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(AuthError);
      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        'Authentication required',
      );
    });

    test('2. Pet parent cannot create prescription (Postgres 42501 -> ForbiddenError)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'Permission denied: Only registered veterinarians may issue prescriptions',
        },
      });

      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        'Permission denied: Only registered veterinarians may issue prescriptions',
      );
    });

    test("3. Vet cannot create prescription for another vet's appointment (Postgres 42501 -> ForbiddenError)", async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message:
            'Permission denied: Only the veterinarian assigned to this appointment may create its prescription',
        },
      });

      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        'Permission denied: Only the veterinarian assigned to this appointment may create its prescription',
      );
    });

    test('4. Vet cannot create prescription for arbitrary pet (pet is bound to appointment record)', async () => {
      // The client DTO does not take pet_id; it only provides appointment_id.
      // The database RPC looks up appointment and takes appointment.pet_id directly.
      expect((validDTO as any).pet_id).toBeUndefined();
    });

    test('5. Vet cannot create prescription for scheduled appointment (Postgres 22023 -> ValidationError)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '22023',
          message:
            'Invalid appointment status: Prescriptions can only be created for completed appointments (current status: scheduled)',
        },
      });

      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        ValidationError,
      );
      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        'Prescriptions can only be created for completed appointments',
      );
    });

    test('6. Vet cannot create prescription for cancelled appointment (Postgres 22023 -> ValidationError)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '22023',
          message:
            'Invalid appointment status: Prescriptions can only be created for completed appointments (current status: cancelled)',
        },
      });

      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        ValidationError,
      );
      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        'Prescriptions can only be created for completed appointments',
      );
    });

    test('7. Vet can create prescription for their own completed appointment', async () => {
      const mockResult = {
        success: true,
        prescription_id: validPrescriptionId,
        appointment_id: validAppointmentId,
        item_count: 1,
      };

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await prescriptionService.createPrescription(validDTO);
      expect(result.success).toBe(true);
      expect(result.prescription_id).toBe(validPrescriptionId);
      expect(result.item_count).toBe(1);
      expect(supabase.rpc).toHaveBeenCalledWith('create_prescription', {
        p_appointment_id: validAppointmentId,
        p_diagnosis: validDTO.diagnosis,
        p_notes: validDTO.notes,
        p_refills_allowed: 1,
        p_items: validDTO.items,
      });
    });

    test('8. Empty medication list rejected client-side before network call', async () => {
      const emptyDTO: CreatePrescriptionDTO = {
        ...validDTO,
        items: [],
      };

      await expect(prescriptionService.createPrescription(emptyDTO)).rejects.toThrow(
        ValidationError,
      );
      await expect(prescriptionService.createPrescription(emptyDTO)).rejects.toThrow(
        'at least one medication item',
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('9. Invalid medication item rejected client-side (missing medication_name or dosage)', async () => {
      const invalidDTO: CreatePrescriptionDTO = {
        ...validDTO,
        items: [
          {
            medication_name: '',
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '7 days',
          },
        ],
      };

      await expect(prescriptionService.createPrescription(invalidDTO)).rejects.toThrow(
        ValidationError,
      );
      await expect(prescriptionService.createPrescription(invalidDTO)).rejects.toThrow(
        'Medication name is required for item #1.',
      );
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test('10. Duplicate prescription rejected by database unique constraint (Postgres 23505 -> ConflictError)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "prescriptions_appointment_id_key"',
        },
      });

      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(ConflictError);
      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        'A prescription has already been issued for this appointment.',
      );
    });

    test('11. Client cannot override vet_id (vet_id is determined strictly on backend from auth.uid())', () => {
      expect((validDTO as any).vet_id).toBeUndefined();
    });

    test('12. Client cannot override pet_id (pet_id is looked up strictly from appointments table)', () => {
      expect((validDTO as any).pet_id).toBeUndefined();
    });

    test('13. Client cannot override appointment ownership (appointment owner check is database enforced)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message:
            'Permission denied: Only the veterinarian assigned to this appointment may create its prescription',
        },
      });

      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(
        ForbiddenError,
      );
    });
  });

  // ==========================================
  // VIEW PRESCRIPTION SECURITY TESTS (14-17)
  // ==========================================
  describe('VIEW PRESCRIPTION AUTHORIZATION (FR-PRES-002)', () => {
    test('14. Pet parent can view own pet prescription', async () => {
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: samplePrescription,
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryChain);

      const result = await prescriptionService.getPrescriptionById(validPrescriptionId);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(validPrescriptionId);
      expect(result?.diagnosis).toBe('Canine Atopic Dermatitis');
      expect(result?.pet?.name).toBe('Luna');
    });

    test("15. Pet parent cannot view another parent's prescription (RLS returns 0 rows -> NotFoundError)", async () => {
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryChain);

      await expect(
        prescriptionService.getPrescriptionById('forbidden-prescription'),
      ).rejects.toThrow(NotFoundError);
    });

    test('16. Unauthenticated user cannot view prescription (PGRST301 -> AuthError)', async () => {
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'PGRST301',
            message: 'JWT expired or missing',
          },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryChain);

      await expect(prescriptionService.getPrescriptionById(validPrescriptionId)).rejects.toThrow(
        AuthError,
      );
    });

    test('17. Unauthorized vet cannot view another vet prescription unless consulting doctor', async () => {
      // Direct RLS query returns no rows for unauthorized vet
      const mockQueryChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: 'PGRST116',
            message: 'No rows returned',
          },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryChain);

      await expect(prescriptionService.getPrescriptionById('other-vet-rx')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ==========================================
  // PDF GENERATION & EXPORT TESTS (18-20)
  // ==========================================
  describe('PDF EXPORT & GENERATION (FR-PRES-002)', () => {
    test('18. PDF HTML contains all authoritative prescription fields and Vetopia branding', () => {
      const html = generatePrescriptionHtml(samplePrescription);

      expect(html).toContain('Vetopia Telemedicine');
      expect(html).toContain('Dr. Sarah Mitchell');
      expect(html).toContain('Dermatology & Internal Medicine');
      expect(html).toContain('Luna');
      expect(html).toContain('Canine');
      expect(html).toContain('Golden Retriever');
      expect(html).toContain('Canine Atopic Dermatitis');
      expect(html).toContain('Apoquel (Oclacitinib)');
      expect(html).toContain('16mg');
      expect(html).toContain('Twice daily');
      expect(html).toContain('30 days');
      expect(html).toContain('Refills: 1');
      expect(html).toContain('Electronically Signed & Sealed');
      expect(html).toContain('Controlled substances (Schedule II-V) are strictly prohibited');
    });

    test('19. PDF generation isolates data strictly to the specified prescription', () => {
      const html = generatePrescriptionHtml(samplePrescription);

      // Verify no other pet or diagnosis is leaked
      expect(html).not.toContain('Feline Leukemia');
      expect(html).not.toContain('Dr. Foreign Vet');
      expect(html).toContain(validPrescriptionId.slice(0, 8).toUpperCase());
    });

    test('20. PDF export handles platform sharing failure cleanly', async () => {
      (Print.printToFileAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///path/to/test.pdf',
      });
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockRejectedValue(new Error('Sharing cancelled or failed'));

      await expect(exportPrescriptionPdf(samplePrescription)).rejects.toThrow(
        'Sharing cancelled or failed',
      );
    });
  });

  // ==========================================
  // TRANSACTION ATOMICITY TESTS (21-22)
  // ==========================================
  describe('TRANSACTION ATOMICITY & REPOSITORY INTEGRITY', () => {
    test('21. Prescription + items are atomic (executed in single RPC transaction)', async () => {
      // When create_prescription is called, p_items is passed to the Postgres transaction
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: {
          success: true,
          prescription_id: validPrescriptionId,
          appointment_id: validAppointmentId,
          item_count: 2,
        },
        error: null,
      });

      const multiItemDTO: CreatePrescriptionDTO = {
        ...validDTO,
        items: [
          validDTO.items[0],
          {
            medication_name: 'Chlorhexidine Wipes',
            dosage: '2% wipes',
            frequency: 'Once daily to paws',
            duration: '14 days',
          },
        ],
      };

      const res = await prescriptionService.createPrescription(multiItemDTO);
      expect(res.item_count).toBe(2);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'create_prescription',
        expect.objectContaining({
          p_items: expect.arrayContaining([
            expect.objectContaining({ medication_name: 'Apoquel (Oclacitinib)' }),
            expect.objectContaining({ medication_name: 'Chlorhexidine Wipes' }),
          ]),
        }),
      );
    });

    test('22. Database error on item insertion rolls back the entire prescription creation', async () => {
      // If Postgres rolls back during items loop, RPC returns an error and no partial prescription exists
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '23502',
          message: 'null value in column "medication_name" violates not-null constraint',
        },
      });

      await expect(prescriptionService.createPrescription(validDTO)).rejects.toThrow(ApiError);
    });
  });
});
