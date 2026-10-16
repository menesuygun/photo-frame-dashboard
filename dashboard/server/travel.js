// Google Routes addresses are geocoded by Routes; no browser API key is needed.
export async function drivingEstimate({ origin, destination, start, key, now = new Date(), fetcher = fetch }) {
  const arrive = new Date(start);
  if (!Number.isFinite(+arrive) || arrive <= now) throw new Error('Event has started');
  async function route(departure) {
    const response = await fetcher('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.duration,fallbackInfo,geocodingResults' },
      body: JSON.stringify({ origin: { address: origin }, destination: { address: destination }, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE_OPTIMAL', trafficModel: 'BEST_GUESS', departureTime: departure.toISOString(), languageCode: 'en-CA', units: 'METRIC' })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const reasons = error.error?.details?.map(d => d.reason) || [];
      throw new Error(response.status === 403 ? (reasons.includes('SERVICE_DISABLED') ? 'routes-disabled' : 'google-access-denied') : 'route-unavailable');
    }
    const data = await response.json();
    if (data.fallbackInfo) throw new Error('traffic-unavailable');
    if (data.geocodingResults?.origin?.partialMatch || data.geocodingResults?.destination?.partialMatch) throw new Error('address-incomplete');
    const match = String(data.routes?.[0]?.duration || '').match(/^(\d+(?:\.\d+)?)s$/);
    if (!match || +match[1] <= 0) throw new Error('route-unavailable');
    return Math.ceil(+match[1] / 60);
  }
  // Forecast traffic near the likely departure, then refine using the first estimate.
  const initial = await route(new Date(Math.max(+now + 60000, +arrive - 30 * 60000)));
  const departure = new Date(Math.max(+now + 60000, +arrive - initial * 60000));
  const minutes = await route(departure);
  return { minutes, leaveBy: new Date(+arrive - minutes * 60000).toISOString(), checkedAt: now.toISOString(), provider: 'Google Maps' };
}
