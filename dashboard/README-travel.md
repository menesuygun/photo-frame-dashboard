# Traffic-aware departure times

Set server-only Production secrets `GOOGLE_MAPS_API_KEY` and `TRAVEL_HOME_ADDRESS` in Vercel. Enable the Google Routes API and billing in the associated Google Cloud project, and restrict the key to that API. Routes accepts origin and destination addresses directly; a separate Geocoding API integration is not used.

Add a full destination address to the iCloud event Location field. The authenticated travel endpoint only routes real, upcoming calendar events in the next 24 hours. The dashboard requests the next event shown in Next up; it never sends its title, attendees, or notes to Google.

Driving time uses TRAFFIC_AWARE_OPTIMAL/BEST_GUESS, first estimating departure near the event and then refining using the first duration. “Leave by” is the event start minus driving minutes, rounded up, with no added parking buffer. Estimates refresh every 30 minutes, including while Today is visible, and are not guarantees of arrival. If Google fails, returns a partial address, or cannot supply traffic-aware routing, the dashboard shows unavailability instead of inventing a time. Old estimates expire after 30 minutes.

The Google key and home address are never included in frontend assets or API responses. Cached routing results are private and memory-only. No route is requested until the frame is unlocked. The API shares the calendar's access code and does not accept arbitrary client-supplied destinations.
