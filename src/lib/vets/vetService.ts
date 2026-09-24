import { supabase } from '../supabase/client';
import {
  VetProfile,
  VetAvailability,
  VetFilterParams,
  DaySchedule,
  TimeSlot,
} from '../../types/vet';
import { ApiError, NotFoundError, ValidationError } from '../api/errors';

/**
 * Format a Date to "HH:mm" (e.g. "09:00" or "14:30")
 */
export function formatSlotTime(d: Date): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format a Date to "YYYY-MM-DD"
 */
export function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date to human-readable label: "Wed, Sep 24"
 */
export function formatDayLabel(d: Date): string {
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${weekdayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Build bookable slots for the next `daysAhead` days from recurring weekly availability
 * minus existing booked appointments and past times.
 * Pure function to facilitate isolated unit testing (FR-VET-002).
 */
export function buildSlots(
  availability: VetAvailability[],
  slotMinutes: number,
  bookedISO: string[],
  daysAhead = 14,
  now: Date = new Date(),
): DaySchedule[] {
  const bookedTimestamps = new Set(bookedISO.map((iso) => new Date(iso).getTime()));
  const currentTimestamp = now.getTime();
  const bufferMs = 15 * 60 * 1000; // 15-minute advance buffer required by SRS
  const result: DaySchedule[] = [];

  for (let i = 0; i < daysAhead; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    day.setHours(0, 0, 0, 0);

    const dayWeekday = day.getDay();
    const matchingWindows = availability.filter((a) => a.weekday === dayWeekday);
    const daySlots: TimeSlot[] = [];

    for (const window of matchingWindows) {
      const step = slotMinutes > 0 ? slotMinutes : 30;
      for (let m = window.start_minute; m + step <= window.end_minute; m += step) {
        const slotStart = new Date(day);
        slotStart.setMinutes(m);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotStart.getMinutes() + step);

        // Omit slots in the past or within 15 minutes of present time
        if (slotStart.getTime() < currentTimestamp + bufferMs) {
          continue;
        }

        // Omit slots that collide with already-scheduled appointments
        if (bookedTimestamps.has(slotStart.getTime())) {
          continue;
        }

        daySlots.push({
          date: formatDateKey(day),
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          formattedTime: formatSlotTime(slotStart),
        });
      }
    }

    // Sort chronologically
    daySlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    if (daySlots.length > 0) {
      result.push({
        date: formatDateKey(day),
        dayLabel: formatDayLabel(day),
        slots: daySlots,
      });
    }
  }

  return result;
}

export class VetService {
  /**
   * Search and filter doctor directory.
   * Authoritative SRS FR-VET-001:
   * - text search `q`
   * - specialty filter (12 specialties)
   * - language filter (11 languages)
   * - country filter
   * - max_price filter
   * - accepting_status filter
   * - Empty search query returns top-rated doctors currently accepting consults.
   */
  public async getVets(filters?: VetFilterParams): Promise<VetProfile[]> {
    try {
      let query = supabase.from('vet_profiles').select('*');

      // Text search: matches name or specialty
      if (filters?.q && filters.q.trim()) {
        const term = filters.q.trim();
        query = query.or(`name.ilike.%${term}%,specialty.ilike.%${term}%`);
      }

      // Specialty filter
      if (filters?.specialty && filters.specialty !== 'All') {
        query = query.eq('specialty', filters.specialty);
      }

      // Language filter
      if (filters?.language && filters.language !== 'All') {
        query = query.contains('languages', [filters.language]);
      }

      // Country filter
      if (filters?.country && filters.country !== 'All') {
        query = query.eq('country', filters.country);
      }

      // Maximum consultation price filter
      if (filters?.max_price !== undefined && filters.max_price > 0) {
        query = query.lte('price_usd', filters.max_price);
      }

      // Accepting status filter
      if (filters?.accepting_only === true) {
        query = query.eq('accepting', true);
      } else if (
        !filters?.q &&
        !filters?.specialty &&
        !filters?.language &&
        !filters?.country &&
        filters?.max_price === undefined &&
        filters?.accepting_only === undefined
      ) {
        // SRS FR-VET-001 Alternative Behavior:
        // "Empty search query returns top-rated doctors currently accepting consults."
        query = query.eq('accepting', true);
      }

      // Order by rating and reviews descending
      query = query.order('rating', { ascending: false }).order('reviews', { ascending: false });

      // Pagination
      if (filters?.page !== undefined && filters?.limit !== undefined) {
        const page = Math.max(1, filters.page);
        const limit = Math.max(1, filters.limit);
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new ApiError(error.message, 500);
      }

      return (data || []) as VetProfile[];
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to fetch veterinarians.', 500);
    }
  }

  /**
   * Fetch a single veterinarian profile by ID.
   * (FR-VET-002)
   */
  public async getVetById(vetId: string): Promise<VetProfile> {
    if (!vetId) {
      throw new ValidationError('Doctor ID is required.');
    }

    try {
      const { data, error } = await supabase
        .from('vet_profiles')
        .select('*')
        .eq('id', vetId)
        .maybeSingle();

      if (error) {
        throw new ApiError(error.message, 500);
      }

      if (!data) {
        throw new NotFoundError('Doctor not found.');
      }

      return data as VetProfile;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to fetch doctor profile.', 500);
    }
  }

  /**
   * Fetch dynamically generated 14-day bookable slots for a doctor.
   * Combines recurring `public.vet_availability` minus existing `public.appointments`.
   * (FR-VET-002)
   */
  public async getVetSchedule(vetId: string, daysAhead = 14): Promise<DaySchedule[]> {
    if (!vetId) {
      throw new ValidationError('Doctor ID is required.');
    }

    try {
      const [vetRes, availRes, apptRes] = await Promise.all([
        supabase
          .from('vet_profiles')
          .select('slot_minutes, accepting')
          .eq('id', vetId)
          .maybeSingle(),
        supabase.from('vet_availability').select('*').eq('vet_id', vetId).order('weekday'),
        supabase
          .from('appointments')
          .select('starts_at')
          .eq('vet_id', vetId)
          .eq('status', 'scheduled')
          .gte('starts_at', new Date().toISOString()),
      ]);

      if (vetRes.error) {
        throw new ApiError(vetRes.error.message, 500);
      }

      if (!vetRes.data) {
        throw new NotFoundError('Doctor not found.');
      }

      if (availRes.error) {
        throw new ApiError(availRes.error.message, 500);
      }

      const slotMinutes = vetRes.data.slot_minutes || 30;
      const availability = (availRes.data || []) as VetAvailability[];
      const bookedIso = ((apptRes.data || []) as { starts_at: string }[]).map((a) => a.starts_at);

      return buildSlots(availability, slotMinutes, bookedIso, daysAhead);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to generate doctor schedule.', 500);
    }
  }
}

export const vetService = new VetService();
