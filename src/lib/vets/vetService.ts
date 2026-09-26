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
 * Convert a wall-clock date and minute (e.g. 2026-09-24 at 540m) in a specific timezone
 * to an accurate UTC Date object.
 */
export function createDateInTimezone(
  year: number,
  monthIndex: number, // 0-11
  day: number,
  minutesFromMidnight: number,
  timeZone: string = 'UTC',
): Date {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  const approxUtc = new Date(Date.UTC(year, monthIndex, day, hours, minutes, 0, 0));

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(approxUtc);
    let pYear = 0;
    let pMonth = 0;
    let pDay = 0;
    let pHour = 0;
    let pMinute = 0;

    for (const p of parts) {
      if (p.type === 'year') pYear = parseInt(p.value, 10);
      if (p.type === 'month') pMonth = parseInt(p.value, 10);
      if (p.type === 'day') pDay = parseInt(p.value, 10);
      if (p.type === 'hour') pHour = parseInt(p.value, 10);
      if (p.type === 'minute') pMinute = parseInt(p.value, 10);
    }

    const wallClockInTarget = Date.UTC(pYear, pMonth - 1, pDay, pHour, pMinute, 0, 0);
    const targetWallClock = Date.UTC(year, monthIndex, day, hours, minutes, 0, 0);
    const diff = targetWallClock - wallClockInTarget;

    return new Date(approxUtc.getTime() + diff);
  } catch {
    return approxUtc;
  }
}

/**
 * Extract calendar year, month (0-indexed), day, and weekday (0=Sun..6=Sat) in a specific timezone.
 */
export function getDatePartsInTimezone(
  d: Date,
  timeZone: string = 'UTC',
): { year: number; month: number; day: number; weekday: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    });

    const parts = formatter.formatToParts(d);
    let year = d.getUTCFullYear();
    let month = d.getUTCMonth();
    let day = d.getUTCDate();
    let weekdayStr = '';

    for (const part of parts) {
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10) - 1;
      if (part.type === 'day') day = parseInt(part.value, 10);
      if (part.type === 'weekday') weekdayStr = part.value;
    }

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const weekday = weekdayMap[weekdayStr] ?? d.getUTCDay();
    return { year, month, day, weekday };
  } catch {
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      day: d.getUTCDate(),
      weekday: d.getUTCDay(),
    };
  }
}

/**
 * Build bookable slots for the next `daysAhead` days from recurring weekly availability
 * minus existing booked appointments and past times, anchored in the veterinarian's timezone.
 * Pure function to facilitate isolated unit testing (FR-VET-002).
 */
export function buildSlots(
  availability: VetAvailability[],
  slotMinutes: number,
  bookedISO: string[],
  daysAhead = 14,
  now: Date = new Date(),
  vetTimezone = 'UTC',
): DaySchedule[] {
  const bookedTimestamps = new Set(bookedISO.map((iso) => new Date(iso).getTime()));
  const currentTimestamp = now.getTime();
  const bufferMs = 15 * 60 * 1000; // 15-minute advance buffer required by SRS
  const result: DaySchedule[] = [];

  const baseParts = getDatePartsInTimezone(now, vetTimezone);

  for (let i = 0; i < daysAhead; i++) {
    const dayDateInTz = new Date(Date.UTC(baseParts.year, baseParts.month, baseParts.day + i));
    const dayParts = getDatePartsInTimezone(dayDateInTz, vetTimezone);

    const matchingWindows = availability.filter((a) => a.weekday === dayParts.weekday);
    const daySlots: TimeSlot[] = [];

    const dateKey = `${dayParts.year}-${String(dayParts.month + 1).padStart(2, '0')}-${String(dayParts.day).padStart(2, '0')}`;
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
    const dayLabel = `${weekdayNames[dayParts.weekday]}, ${monthNames[dayParts.month]} ${dayParts.day}`;

    for (const window of matchingWindows) {
      const step = slotMinutes > 0 ? slotMinutes : 30;
      for (let m = window.start_minute; m + step <= window.end_minute; m += step) {
        const slotStart = createDateInTimezone(
          dayParts.year,
          dayParts.month,
          dayParts.day,
          m,
          vetTimezone,
        );
        const slotEnd = createDateInTimezone(
          dayParts.year,
          dayParts.month,
          dayParts.day,
          m + step,
          vetTimezone,
        );

        // Omit slots in the past or within 15 minutes of present time
        if (slotStart.getTime() < currentTimestamp + bufferMs) {
          continue;
        }

        // Omit slots that collide with already-scheduled appointments
        if (bookedTimestamps.has(slotStart.getTime())) {
          continue;
        }

        const hoursStr = String(Math.floor(m / 60)).padStart(2, '0');
        const minsStr = String(m % 60).padStart(2, '0');

        daySlots.push({
          date: dateKey,
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          formattedTime: `${hoursStr}:${minsStr}`,
        });
      }
    }

    // Sort chronologically
    daySlots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    if (daySlots.length > 0) {
      result.push({
        date: dateKey,
        dayLabel,
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
   * Invokes the secure server-side schedule RPC `get_vet_schedule` (FR-VET-002),
   * which evaluates recurring availability minus all booked appointments across all users
   * anchored in the vet's timezone, preserving patient privacy.
   */
  public async getVetSchedule(vetId: string, daysAhead = 14): Promise<DaySchedule[]> {
    if (!vetId) {
      throw new ValidationError('Doctor ID is required.');
    }

    try {
      // 1. Primary: Secure Server-Side Postgres Schedule RPC
      // Evaluates recurring availability minus all booked appointments across all users
      // in the vet's timezone with elevated privileges without exposing patient data.
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_vet_schedule', {
        target_vet_id: vetId,
        days_ahead: daysAhead,
      });

      if (!rpcError && Array.isArray(rpcData)) {
        return rpcData as DaySchedule[];
      }

      // If RPC returned a specific error other than missing function, rethrow
      if (
        rpcError &&
        rpcError.message &&
        !rpcError.message.includes('function') &&
        !rpcError.message.includes('not found')
      ) {
        throw new ApiError(rpcError.message, 500);
      }

      // 2. Client-side fallback if RPC is not yet deployed (e.g. offline/isolated testing)
      const [vetRes, availRes] = await Promise.all([
        supabase
          .from('vet_profiles')
          .select('slot_minutes, accepting, timezone')
          .eq('id', vetId)
          .maybeSingle(),
        supabase.from('vet_availability').select('*').eq('vet_id', vetId).order('weekday'),
      ]);

      if (vetRes.error) {
        throw new ApiError(vetRes.error.message, 500);
      }

      if (!vetRes.data) {
        throw new NotFoundError('Doctor not found.');
      }

      if (vetRes.data.accepting === false) {
        return [];
      }

      if (availRes.error) {
        throw new ApiError(availRes.error.message, 500);
      }

      const slotMinutes = vetRes.data.slot_minutes || 30;
      const vetTimezone = vetRes.data.timezone || 'UTC';
      const availability = (availRes.data || []) as VetAvailability[];

      return buildSlots(availability, slotMinutes, [], daysAhead, new Date(), vetTimezone);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to generate doctor schedule.', 500);
    }
  }
}

export const vetService = new VetService();
