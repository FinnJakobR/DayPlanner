import { isAfter, isBefore, Time, Timing } from "../models/time.js";

const EARTH_RADIUS_KM = 6.371;
const BERLIN_COORDS: Coord = {
  lat: 52.52437,
  long: 13.41053,
};

export interface Coord {
  lat: number;
  long: number;
}

export function haversine(alpha: number) {
  return (1 - Math.cos(alpha)) / 2;
}

export function calcDistanceInKm(x: Coord, y: Coord) {
  const lat1 = degToRad(x.lat);
  const lat2 = degToRad(y.lat);
  const deltaLat = degToRad(y.lat - x.lat);
  const deltaLon = degToRad(y.long - x.long);

  const a =
    haversine(deltaLat) + Math.cos(lat1) * Math.cos(lat2) * haversine(deltaLon);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function degToRad(deg: number) {
  return (Math.PI / 180) * deg;
}

function radToDeg(deg: number) {
  return (180 / Math.PI) * deg;
}

export enum zenith {
  OFFICIAL = 90,
  CIVIL = 96,
  NAUTICAL = 102,
  ASTONOMICAL = 108,
}

export enum TIME {
  RISING,
  SETTING,
}

interface MathIntervall {
  start: Time;
  end: Time;
}

function getDayOfYear(): number {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 0);
  var diff =
    now.getTime() -
    start.getTime() +
    (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000;
  var oneDay = 1000 * 60 * 60 * 24;
  var day = Math.floor(diff / oneDay);

  return day;
}

export function getSunTime(zenithAngle: zenith, time: TIME): Time {
  const dayOfYear = getDayOfYear();
  const lngHour = BERLIN_COORDS.long / 15;

  const timeFactor = time === TIME.RISING ? 6 : 18;
  const t = dayOfYear + (timeFactor - lngHour) / 24;

  const M = 0.9856 * t - 3.289;
  const rad_M = degToRad(M);

  const L =
    (M + 1.916 * Math.sin(rad_M) + 0.2 * Math.sin(2 * rad_M) + 282.634) % 360;
  const rad_L = degToRad(L);

  let RA = radToDeg(Math.atan(0.91764 * Math.tan(rad_L)));
  const Lquadrant = Math.floor(L / 90) * 90;
  const RAquadrant = Math.floor(RA / 90) * 90;
  RA = RA + (Lquadrant - RAquadrant);
  RA /= 15;

  const sinDec = 0.39782 * Math.sin(rad_L);
  const cosDec = Math.cos(Math.asin(sinDec));

  const rad_lat = degToRad(BERLIN_COORDS.lat);
  const rad_zenith = degToRad(zenithAngle);

  const cosH =
    (Math.cos(rad_zenith) - sinDec * Math.sin(rad_lat)) /
    (cosDec * Math.cos(rad_lat));

  if (cosH > 1 && time === TIME.RISING)
    return new Time({ hour: 0, minute: 0, second: 0 });
  if (cosH < -1 && time === TIME.SETTING)
    return new Time({ hour: 0, minute: 0, second: 0 });

  const H =
    time === TIME.RISING
      ? 360 - radToDeg(Math.acos(cosH))
      : radToDeg(Math.acos(cosH));
  const hHours = H / 15;

  const T = hHours + RA - 0.06571 * t - 6.622;
  const UT = (T - lngHour + 24) % 24;

  const localOffsetHours = -new Date().getTimezoneOffset() / 60;
  const localTime = UT + localOffsetHours;

  return Timing.fromHours(localTime);
}
