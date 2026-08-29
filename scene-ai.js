/**
 * Optional cloud scene helpers. Live listening never depends on these.
 */

export function findTargetInScene(targetName, items = []) {
  const query = targetName.toLowerCase().trim();
  const matched = items.find((i) => {
    const className = (i.class || '').toLowerCase();
    const label = (i.profile?.label || '').toLowerCase();
    return className.includes(query) || label.includes(query) || query.includes(className);
  });

  if (matched) {
    const clock = matched.clockHour || 12;
    const meters = matched.distanceMeters ? matched.distanceMeters.toFixed(1) : null;
    const direction = matched.pan < -0.3 ? 'left' : matched.pan > 0.3 ? 'right' : 'ahead';
    const dist = meters ? `, about ${meters} meters` : '';
    return {
      found: true,
      item: matched,
      speech: `${targetName} ${direction} at ${clock} o'clock${dist}.`,
    };
  }

  return {
    found: false,
    item: null,
    speech: `No ${targetName} in the camera view. Turn slowly. I can only see supported objects.`,
  };
}
