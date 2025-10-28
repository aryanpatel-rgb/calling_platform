import axios from 'axios';
import { DateTime } from 'luxon';

const CAL_API_BASE = 'https://api.cal.com/v2';
const CAL_API_VERSION = '2024-09-04'; // Match Cal.com API version

/**
 * Check calendar availability from Cal.com
 */
export async function checkAvailability(config) {
  try {
    const { apiKey, eventTypeId, startDate, endDate, timezone } = config;


    const start = startDate || DateTime.utc().toISO();
    const end = endDate || DateTime.utc().plus({ days: 7 }).toISO();

    const response = await axios.get(`${CAL_API_BASE}/slots`, {
      params: {
        eventTypeId,
        start,
        end,
        timeZone: timezone || 'UTC',
        format: 'range'
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'cal-api-version': CAL_API_VERSION,
        'Content-Type': 'application/json'
      }
    });

    const { data } = response;
    if (!data || data.status !== 'success' || !data.data) {
      return { success: false, error: data?.error || 'Invalid response from Cal.com API', availableSlots: [] };
    }

    const availableSlots = Object.entries(data.data).flatMap(
      ([dateStr, slots]) =>
        Array.isArray(slots)
          ? slots.map(slot => ({
              date: dateStr,
              start: slot.start,
              end: slot.end,
              timeFormatted: DateTime.fromISO(slot.start).toLocaleString(DateTime.TIME_SIMPLE),
              dateFormatted: DateTime.fromISO(slot.start).toLocaleString(DateTime.DATE_MED)
            }))
          : []
    );

    return { success: true, availableSlots, count: availableSlots.length, timezone: timezone || 'UTC' };

  } catch (error) {
    const errData = error.response?.data || {};
    console.error('❌ Cal.com availability error:', errData);
    throw new Error(`Failed to check availability: ${errData.error?.message || errData.message || error.message || 'Unknown error'}`);
  }
}

/**
 * Book an appointment via Cal.com API
 */
export async function bookAppointment(config) {
  try {
    const { apiKey, eventTypeId, startTime, attendeeName, attendeeEmail, attendeeTimezone } = config;

    console.log('📅 Booking request:', { apiKey, eventTypeId, startTime, attendeeName, attendeeEmail, attendeeTimezone });

    const response = await axios.post(
      'https://api.cal.com/v2/bookings', // must be exact
      {
        eventTypeId: parseInt(eventTypeId), // number
        start: startTime,
        attendee: {
          name: attendeeName,
          email: attendeeEmail,
          timeZone: attendeeTimezone
        },
        metadata: { source: 'ai-agent-platform' }
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'cal-api-version': '2024-08-13',
          'Content-Type': 'application/json'
        }
      }
    );

    const booking = response.data.data;
    return { success: true, booking };

  } catch (error) {
    console.error('Cal.com booking error:', error.response?.data || error.message);
    throw new Error(`Failed to book appointment: ${error.response?.data?.error?.message || error.message}`);
  }
}


/**
 * Convert human-readable date + time into ISO 8601 string in given timezone
 */
export function parseDateTimeToISO(dateStr, timeStr, tz = 'UTC') {
  // Clean the date string (remove "th", "st", "nd", "rd")
  const cleanedDate = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1');

  // Try multiple date formats
  const formats = [
    'd LLL yyyy hh:mm a', // 29 Oct 2025 04:00 PM
    'd LLL hh:mm a',      // 29 Oct 04:00 PM
    'd LLL yyyy h:mm a',  // 29 Oct 2025 4:00 PM
    'd LLL h:mm a',       // 29 Oct 4:00 PM
    'd LLL yyyy h a',     // 29 Oct 2025 4 PM
    'd LLL h a'           // 29 Oct 4 PM
  ];

  let dt = null;

  for (const fmt of formats) {
    dt = DateTime.fromFormat(`${cleanedDate} ${timeStr}`, fmt, { zone: tz });
    if (dt.isValid) break;
  }

  if (!dt || !dt.isValid) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr} in timezone ${tz}`);
  }

  return dt.toUTC().toISO(); // Convert to UTC ISO string
}

/**
 * Execute Cal.com function based on type
 */
export async function executeCalComFunction(functionConfig, parameters) {
  const { sub_type, api_key: apiKey, event_type_id, timezone } = functionConfig;

  if (sub_type === 'check_availability') {
    return await checkAvailability({
      apiKey,
      eventTypeId: event_type_id,
      startDate: parameters.startDate,
      endDate: parameters.endDate,
      timezone: parameters.timezone || timezone
    });
  } else if (sub_type === 'book_appointment') {
    let startTime = parameters.startTime;

    if (!startTime && parameters.date && parameters.time) {
      startTime = parseDateTimeToISO(parameters.date, parameters.time, parameters.timezone || timezone || 'UTC');
    }

    if (!startTime) throw new Error('⚠️ Missing startTime or date+time parameters');

    return await bookAppointment({
      apiKey,
      eventTypeId: event_type_id,
      startTime,
      attendeeName: parameters.attendeeName || parameters.name || parameters.attendee_name || 'Guest User',
      attendeeEmail: "guest@example.com",
      attendeeTimezone: parameters.timezone || parameters.attendee_timezone || timezone,
      timezone
    });
  }

  throw new Error(`Unknown Cal.com function type: ${sub_type}`);
}

export default {
  checkAvailability,
  bookAppointment,
  executeCalComFunction
};
