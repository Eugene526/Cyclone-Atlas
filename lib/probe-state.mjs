export const alphaTemperature=alpha=>50-alpha/255*140;
export function acceptThermal(previous,next){return next.loading?next:previous&&previous.time===next.time&&previous.lon===next.lon&&previous.lat===next.lat?next:previous}
