/** A channel owns only its newest read. Reset also invalidates A → B → A responses. */
export function createLatestRequests() {
  let epoch = 0;
  const requests = new Map<string, number>();
  return {
    reset() { epoch++; requests.clear(); },
    start(channel: string) {
      const generation = epoch, id = (requests.get(channel) || 0) + 1;
      requests.set(channel, id);
      return () => generation === epoch && requests.get(channel) === id;
    },
  };
}
